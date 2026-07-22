
/**
 * Database Query Executor
 *
 * Executes LLM-generated SQL under a strict security policy:
 *  - AST-based validation with per-database table allowlists (lib/sql-validator.ts)
 *  - READ ONLY transaction + statement timeout + row cap on a restricted
 *    connection (lib/query-db.ts)
 *  - Multi-tier result caching (lib/db-optimization.ts)
 */

import { createHash } from 'crypto'
import { validateGeneratedSQL, validateSQLAgainstAllowlist, sanitizeSQLForLogging } from './sql-validator'
import { executeGeneratedSQL, GeneratedSQLResult } from './query-db'
import { executeExternalSQL } from './external-db'
import { cachedQuery } from './db-optimization'

/**
 * When set, the query targets a user-registered external connection instead
 * of a built-in demo database. The allowlist comes from schema introspection
 * of that connection.
 */
export interface ExternalQueryTarget {
  connectionId: string
  organizationId: string
  allowlist: readonly string[]
  /** Human-readable name used in error messages */
  label: string
}

export interface QueryExecutionResult {
  data: any[]
  executionTime: number
  rowCount: number
  confidence: number
  suggestions: string[]
  visualization?: VisualizationConfig
  explanation?: string
  /** True when results were cut off at the server-side row cap */
  truncated?: boolean
}

export interface VisualizationConfig {
  type: 'bar' | 'line' | 'pie' | 'table'
  title: string
  xAxis?: string
  yAxis?: string
  data: any[]
}

/**
 * Execute a natural language query against the actual database
 */
export async function executeQuery(
  databaseId: string,
  sql: string,
  naturalQuery: string,
  external?: ExternalQueryTarget
): Promise<QueryExecutionResult> {
  const startTime = Date.now()

  try {
    if (!sql || !sql.trim()) {
      throw new Error('No SQL query provided by the LLM')
    }

    // SECURITY: parse the SQL and enforce the table allowlist for this
    // target before anything touches a connection
    const validation = external
      ? validateSQLAgainstAllowlist(sql, external.allowlist, external.label)
      : validateGeneratedSQL(sql, databaseId)
    if (!validation.valid) {
      console.error('SQL Validation Failed:', validation.error)
      console.error('Rejected SQL:', sanitizeSQLForLogging(sql))
      throw new Error(`Query rejected: ${validation.error}`)
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Executing SQL:', sanitizeSQLForLogging(sql))
    }

    // Cache key uses the full SQL hash — prefixes are collision-prone
    const cacheKey = `query:${databaseId}:${createHash('sha256').update(sql).digest('hex')}`
    const execResult = await cachedQuery<GeneratedSQLResult>(sql, cacheKey, undefined, () =>
      external
        ? executeExternalSQL(external.connectionId, external.organizationId, sql)
        : executeGeneratedSQL(sql)
    )

    const result = execResult.rows
    console.log(`Query returned ${result.length} rows${execResult.truncated ? ' (truncated)' : ''}`)

    const executionTime = Date.now() - startTime

    const confidence = calculateConfidence(result, naturalQuery)
    const suggestions = generateSuggestions(result, databaseId, naturalQuery)
    if (execResult.truncated) {
      suggestions.unshift('Results were limited to the first 1,000 rows — add filters to narrow them down')
    }
    const visualization = determineVisualization(result, naturalQuery)

    return {
      data: result,
      executionTime,
      rowCount: result.length,
      confidence,
      suggestions,
      visualization,
      truncated: execResult.truncated,
    }
  } catch (error) {
    console.error('Query execution error:', error)
    console.error('Failed SQL:', sanitizeSQLForLogging(sql))
    throw error
  }
}

/**
 * Calculate confidence score based on result quality
 * Factors considered:
 * - SQL execution success
 * - Data availability and completeness
 * - Query specificity and intent matching
 * - Result set size appropriateness
 */
function calculateConfidence(result: any[], query: string): number {
  const queryLower = query.toLowerCase()

  // No results = low confidence (query may be too restrictive or data doesn't exist)
  if (result.length === 0) {
    return 0.35 // 35% - query executed but found nothing
  }

  // Start with strong base confidence for successful execution with results
  let confidence = 0.80 // 80% base - SQL executed successfully and returned data

  // Factor 1: Result set size appropriateness (±0.10)
  if (result.length >= 1 && result.length <= 3) {
    // Very few results - might be too restrictive or exactly what was asked
    if (queryLower.includes('top 1') || queryLower.includes('single') || queryLower.includes('one')) {
      confidence += 0.10 // Perfect - user wanted specific result
    } else {
      confidence -= 0.05 // Questionable - user may have expected more
    }
  } else if (result.length >= 4 && result.length <= 20) {
    confidence += 0.08 // Good result set size
  } else if (result.length > 100) {
    confidence -= 0.05 // Too many results, might not be specific enough
  }

  // Factor 2: Query intent matching (±0.08)
  const specificKeywords = ['top', 'recent', 'latest', 'best', 'highest', 'lowest', 'most', 'least', 'average', 'sum', 'total', 'count']
  const hasSpecificIntent = specificKeywords.some(keyword => queryLower.includes(keyword))

  if (hasSpecificIntent) {
    confidence += 0.08 // User asked for specific analysis - likely accurate
  }

  // Factor 3: Data completeness check (±0.07)
  if (result.length > 0) {
    const firstRow = result[0]
    const keys = Object.keys(firstRow)
    const nullCount = keys.filter(key => firstRow[key] === null || firstRow[key] === undefined).length
    const nullRatio = keys.length > 0 ? nullCount / keys.length : 0

    if (nullRatio === 0) {
      confidence += 0.07 // All fields populated - high quality data
    } else if (nullRatio > 0.5) {
      confidence -= 0.10 // Too many nulls - data quality concern
    }
  }

  // Factor 4: Numeric data presence for analytical queries (±0.05)
  if (queryLower.includes('how much') || queryLower.includes('how many') ||
      queryLower.includes('total') || queryLower.includes('average') ||
      queryLower.includes('sum') || queryLower.includes('count')) {
    // Check if results contain numeric data
    const hasNumericData = result.some(row =>
      Object.values(row).some(val => typeof val === 'number')
    )
    if (hasNumericData) {
      confidence += 0.05 // Query intent matches result type
    } else {
      confidence -= 0.08 // Missing expected numeric data
    }
  }

  // Factor 5: Date/time queries (±0.03)
  if (queryLower.includes('recent') || queryLower.includes('latest') ||
      queryLower.includes('last') || queryLower.includes('past')) {
    const hasDateData = result.some(row =>
      Object.keys(row).some(key => key.includes('date') || key.includes('time'))
    )
    if (hasDateData) {
      confidence += 0.03 // Time-based query has temporal data
    }
  }

  // Ensure confidence stays within valid range [0.35, 1.0]
  return Math.max(0.35, Math.min(confidence, 1.0))
}

/**
 * Generate actionable suggestions based on results
 */
function generateSuggestions(result: any[], databaseId: string, query: string): string[] {
  const suggestions: string[] = []

  if (result.length === 0) {
    suggestions.push('Try broadening your search criteria')
    suggestions.push('Check if the data exists in this database')
    return suggestions
  }

  // Database-specific suggestions
  switch (databaseId) {
    case 'sales':
      if (query.includes('customer')) {
        suggestions.push('View detailed customer purchase history')
        suggestions.push('Analyze customer lifetime value trends')
      }
      if (query.includes('product')) {
        suggestions.push('Check inventory levels for these products')
        suggestions.push('Review product pricing strategy')
      }
      break

    case 'hr':
      if (query.includes('department')) {
        suggestions.push('Compare department performance metrics')
        suggestions.push('Review headcount allocation across teams')
      }
      if (query.includes('salary')) {
        suggestions.push('Benchmark salaries against industry standards')
        suggestions.push('Analyze compensation trends over time')
      }
      break

    case 'inventory':
      if (query.includes('low') || query.includes('stock')) {
        suggestions.push('Create purchase orders for low stock items')
        suggestions.push('Review minimum stock levels')
      }
      suggestions.push('Optimize warehouse capacity utilization')
      break

    case 'finance':
      if (query.includes('budget')) {
        suggestions.push('Identify categories exceeding budget')
        suggestions.push('Forecast end-of-year budget status')
      }
      suggestions.push('Analyze cash flow patterns')
      break

    case 'customer_support':
      if (query.includes('ticket')) {
        suggestions.push('Prioritize high-priority open tickets')
        suggestions.push('Assign tickets to available agents')
      }
      suggestions.push('Analyze ticket resolution times')
      break
  }

  // Add export suggestion
  suggestions.push('Export this data for further analysis')

  return suggestions.slice(0, 3) // Return top 3 suggestions
}

/**
 * Determine best visualization type for the data
 */
function determineVisualization(result: any[], query: string): VisualizationConfig | undefined {
  if (result.length === 0) return undefined

  const firstRow = result[0]
  const keys = Object.keys(firstRow)

  // Look for common patterns
  const hasAmount = keys.some(k =>
    k.includes('amount') || k.includes('spent') || k.includes('balance') ||
    k.includes('salary') || k.includes('price') || k.includes('value')
  )
  const hasCount = keys.some(k => k.includes('count') || k.includes('quantity'))
  const hasName = keys.some(k => k.includes('name') || k.includes('department') || k.includes('category'))

  // Bar chart for comparisons
  if (hasName && (hasAmount || hasCount)) {
    const nameKey = keys.find(k => k.includes('name') || k.includes('department') || k.includes('category')) || keys[0]
    const valueKey = keys.find(k => k.includes('amount') || k.includes('spent') || k.includes('count') || k.includes('salary')) || keys[1]

    return {
      type: 'bar',
      title: 'Data Comparison',
      xAxis: nameKey,
      yAxis: valueKey,
      data: result.slice(0, 10) // Limit to 10 items for readability
    }
  }

  // Line chart for time series
  if (keys.some(k => k.includes('date') || k.includes('month') || k.includes('year'))) {
    const dateKey = keys.find(k => k.includes('date') || k.includes('month') || k.includes('year'))
    const valueKey = keys.find(k => k.includes('amount') || k.includes('count') || k.includes('value'))

    if (dateKey && valueKey) {
      return {
        type: 'line',
        title: 'Trend Over Time',
        xAxis: dateKey,
        yAxis: valueKey,
        data: result
      }
    }
  }

  // Default to table
  return {
    type: 'table',
    title: 'Query Results',
    data: result
  }
}
