/**
 * AST-based SQL validation for LLM-generated queries
 *
 * Replaces the previous regex-based validator. The generated SQL is parsed
 * into an AST (fail-closed: anything unparseable is rejected) and checked
 * against a strict policy:
 *
 *   1. Exactly one statement, and it must be a SELECT (CTEs/UNIONs allowed)
 *   2. Every referenced table must be on the allowlist for the database the
 *      user is querying — app tables (User, audit_logs, organizations,
 *      zk_database_connections, ...) and system catalogs are unreachable
 *   3. No schema-qualified references outside "public"
 *   4. No calls to dangerous or information-leaking functions
 *   5. Bounded complexity (number of SELECT nodes)
 *
 * This runs in addition to (not instead of) the execution-side defenses:
 * READ ONLY transactions, statement timeouts, and a row cap in
 * lib/query-db.ts, plus the restricted database role described in
 * prisma/sql/setup-readonly-role.sql.
 */

import { parse } from 'pgsql-ast-parser'

/** Tables each demo database is allowed to touch */
export const DATABASE_TABLE_ALLOWLISTS: Record<string, readonly string[]> = {
  sales: [
    'sales_customers',
    'sales_companies',
    'sales_products',
    'sales_orders',
    'sales_order_items',
  ],
  hr: ['hr_departments', 'hr_employees', 'hr_performance'],
  inventory: ['inv_warehouses', 'inv_suppliers', 'inv_products', 'inv_inventory'],
  finance: ['fin_accounts', 'fin_transactions', 'fin_budgets'],
  customer_support: ['cust_customers', 'cust_tickets', 'cust_interactions'],
}

/** Statement node types that represent a read-only SELECT shape */
const ALLOWED_STATEMENT_TYPES = new Set([
  'select',
  'union',
  'union all',
  'with',
  'with recursive',
])

/**
 * Functions that read files, sleep, open connections, or leak
 * server/configuration state. Matched case-insensitively on the unqualified
 * function name.
 */
const BLOCKED_FUNCTIONS = new Set([
  'pg_read_file',
  'pg_read_binary_file',
  'pg_ls_dir',
  'pg_stat_file',
  'pg_logdir_ls',
  'lo_import',
  'lo_export',
  'pg_sleep',
  'pg_sleep_for',
  'pg_sleep_until',
  'dblink',
  'dblink_connect',
  'dblink_exec',
  'pg_terminate_backend',
  'pg_cancel_backend',
  'pg_reload_conf',
  'pg_rotate_logfile',
  'set_config',
  'current_setting',
  'query_to_xml',
  'table_to_xml',
  'database_to_xml',
  'database_to_xmlschema',
  'pg_export_snapshot',
  'txid_current',
  'inet_client_addr',
  'inet_server_addr',
  'version',
])

const MAX_SELECT_NODES = 5

export interface SQLValidationResult {
  valid: boolean
  error?: string
  /** Tables the statement references (excluding CTE names), when valid */
  tables?: string[]
}

interface WalkState {
  tables: { name: string; schema?: string }[]
  functions: string[]
  cteNames: Set<string>
  selectCount: number
}

/**
 * Generic recursive walk over the parsed AST. Collects table references,
 * function calls, CTE names, and SELECT-node count. A structural walk (rather
 * than per-node-type visitors) means new or unexpected node types can't slip
 * a table reference past us unnoticed — every object in the tree is visited.
 */
function walk(node: unknown, state: WalkState): void {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, state)
    return
  }
  if (node === null || typeof node !== 'object') return

  const n = node as Record<string, any>

  switch (n.type) {
    case 'select':
      state.selectCount++
      break
    case 'table': {
      // FROM/JOIN table reference: { type: 'table', name: { name, schema? } }
      const ref = typeof n.name === 'object' && n.name !== null ? n.name : n
      if (typeof ref.name === 'string') {
        state.tables.push({ name: ref.name.toLowerCase(), schema: ref.schema?.toLowerCase() })
      }
      break
    }
    case 'call': {
      // Function call: { type: 'call', function: { name, schema? } }
      const fn = typeof n.function === 'object' && n.function !== null ? n.function : {}
      if (typeof fn.name === 'string') state.functions.push(fn.name.toLowerCase())
      break
    }
    case 'with':
    case 'with recursive': {
      // CTE names are virtual tables, legal to reference afterwards
      if (Array.isArray(n.bind)) {
        for (const b of n.bind) {
          const alias = b?.alias?.name
          if (typeof alias === 'string') state.cteNames.add(alias.toLowerCase())
        }
      }
      break
    }
  }

  for (const key of Object.keys(n)) {
    walk(n[key], state)
  }
}

/**
 * Validate LLM-generated SQL against the policy for a given database.
 * Fail-closed: parse errors and unknown databases are rejected.
 */
export function validateGeneratedSQL(sql: string, databaseId: string): SQLValidationResult {
  if (!sql || sql.trim().length === 0) {
    return { valid: false, error: 'Empty SQL query' }
  }

  const allowlist = DATABASE_TABLE_ALLOWLISTS[databaseId]
  if (!allowlist) {
    return { valid: false, error: `Unknown database: ${databaseId}` }
  }

  let statements
  try {
    statements = parse(sql)
  } catch (e) {
    return {
      valid: false,
      error: `SQL could not be parsed: ${e instanceof Error ? e.message.split('\n')[0] : 'syntax error'}`,
    }
  }

  if (statements.length === 0) {
    return { valid: false, error: 'Empty SQL query' }
  }
  if (statements.length > 1) {
    return { valid: false, error: 'Only a single statement is allowed' }
  }

  const statement = statements[0] as { type: string }
  if (!ALLOWED_STATEMENT_TYPES.has(statement.type)) {
    return { valid: false, error: `Only SELECT queries are allowed (got ${statement.type.toUpperCase()})` }
  }

  const state: WalkState = { tables: [], functions: [], cteNames: new Set(), selectCount: 0 }
  walk(statement, state)

  if (state.selectCount > MAX_SELECT_NODES) {
    return { valid: false, error: `Query too complex (max ${MAX_SELECT_NODES} SELECT clauses allowed)` }
  }

  for (const fn of state.functions) {
    if (BLOCKED_FUNCTIONS.has(fn)) {
      return { valid: false, error: `Function "${fn}" is not allowed` }
    }
  }

  const allowed = new Set(allowlist)
  const referenced = new Set<string>()
  for (const table of state.tables) {
    if (table.schema && table.schema !== 'public') {
      return { valid: false, error: `Schema "${table.schema}" is not accessible` }
    }
    if (state.cteNames.has(table.name)) continue
    if (!allowed.has(table.name)) {
      return { valid: false, error: `Table "${table.name}" is not accessible from the ${databaseId} database` }
    }
    referenced.add(table.name)
  }

  return { valid: true, tables: [...referenced] }
}

/**
 * Sanitizes SQL for logging (strips literals and long numbers that may be PII)
 */
export function sanitizeSQLForLogging(sql: string): string {
  return sql
    .replace(/'[^']*'/g, "'***'")
    .replace(/"[^"]*"/g, '"***"')
    .replace(/\b\d{6,}\b/g, '######')
}
