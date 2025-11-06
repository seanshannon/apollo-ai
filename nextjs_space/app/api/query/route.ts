
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { maskQueryResults, maskPII } from '@/lib/pii-masking'
import { createAuditLog } from '@/lib/audit'
import { executeQuery } from '@/lib/database-query-executor'
import { storeQueryPattern, searchSimilarQueries } from '@/lib/vector-db'
import { queryRateLimiter } from '@/lib/rate-limit'

export const dynamic = "force-dynamic"
export const maxDuration = 60 // Allow up to 60 seconds for complex queries

/**
 * Query cache to ensure consistent SQL generation for identical queries
 * Cache key: `${query.toLowerCase().trim()}:${databaseId}`
 * Cache value: { sql: string, timestamp: number }
 * Cache TTL: 1 hour (queries older than 1 hour are evicted)
 */
const queryCache = new Map<string, { sql: string; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get cached SQL for a query, or null if not found/expired
 */
function getCachedSQL(query: string, databaseId: string): string | null {
  const cacheKey = `${query.toLowerCase().trim()}:${databaseId}`;
  const cached = queryCache.get(cacheKey);
  
  if (!cached) return null;
  
  // Check if cache entry is expired
  const age = Date.now() - cached.timestamp;
  if (age > CACHE_TTL_MS) {
    queryCache.delete(cacheKey);
    return null;
  }
  
  return cached.sql;
}

/**
 * Cache SQL for a query
 */
function cacheSQL(query: string, databaseId: string, sql: string): void {
  const cacheKey = `${query.toLowerCase().trim()}:${databaseId}`;
  queryCache.set(cacheKey, {
    sql,
    timestamp: Date.now()
  });
  
  // Evict old entries if cache is getting too large (keep max 1000 entries)
  if (queryCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of queryCache.entries()) {
      if (now - value.timestamp > CACHE_TTL_MS) {
        queryCache.delete(key);
      }
    }
    
    // If still too large after eviction, remove oldest 20% entries
    if (queryCache.size > 1000) {
      const entries = Array.from(queryCache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = Math.floor(entries.length * 0.2);
      for (let i = 0; i < toRemove; i++) {
        queryCache.delete(entries[i][0]);
      }
    }
  }
}

/**
 * Convert BigInt values to strings for JSON serialization
 * PostgreSQL COUNT() and other aggregate functions return BigInt which cannot be JSON serialized
 */
function convertBigIntToString(data: any): any {
  if (data === null || data === undefined) return data
  
  if (typeof data === 'bigint') {
    return data.toString()
  }
  
  if (Array.isArray(data)) {
    return data.map(item => convertBigIntToString(item))
  }
  
  if (typeof data === 'object') {
    const converted: any = {}
    for (const key in data) {
      converted[key] = convertBigIntToString(data[key])
    }
    return converted
  }
  
  return data
}

/**
 * Generate actionable next steps for queries based on context and results
 * Adds [NEXT_STEPS]: markers to resolution field for support/login issues
 */
function generateNextSteps(query: string, data: any[]): any[] {
  if (!data || data.length === 0) return data
  
  const queryLower = query.toLowerCase()
  const isLoginQuery = queryLower.includes('login') || queryLower.includes('log in') || 
                       queryLower.includes("couldn't") || queryLower.includes("can't") ||
                       queryLower.includes('unable') || queryLower.includes('access')
  
  const isSupportQuery = queryLower.includes('ticket') || queryLower.includes('issue') || 
                         queryLower.includes('problem') || queryLower.includes('support')
  
  // If this is a login or support query, enhance the data with next steps
  if ((isLoginQuery || isSupportQuery) && data.length > 0) {
    return data.map((row: any) => {
      const enhancedRow = { ...row }
      
      // Check for resolution or subject fields
      const resolution = row.resolution || row.RESOLUTION || ''
      const subject = row.subject || row.SUBJECT || ''
      const status = (row.status || row.STATUS || '').toUpperCase()
      
      let nextStepsText = ''
      
      // Generate specific next steps based on the issue
      if (resolution.toLowerCase().includes('session timeout') || 
          resolution.toLowerCase().includes('timeout')) {
        nextStepsText = '[NEXT_STEPS]: The session timeout is configured correctly. User should try logging in again and ensure they complete the login process within the session timeout window.'
      } else if (resolution.toLowerCase().includes('suspended') || 
                 resolution.toLowerCase().includes('payment')) {
        nextStepsText = '[NEXT_STEPS]: Account is suspended due to payment issues. Contact billing department to resolve payment and reactivate the account. Email billing@company.com or call extension 2500.'
      } else if (resolution.toLowerCase().includes('expired password') || 
                 subject.toLowerCase().includes('expired password')) {
        nextStepsText = '[NEXT_STEPS]: Password has expired. User needs to use the "Forgot Password" link on the login page to reset their password. If issues persist, IT support can manually reset the password via admin console.'
      } else if (resolution.toLowerCase().includes('locked') || 
                 subject.toLowerCase().includes('locked')) {
        nextStepsText = '[NEXT_STEPS]: Account is locked due to multiple failed login attempts. Wait 30 minutes for automatic unlock, or IT support can manually unlock the account in the admin console under User Management > Unlock Account.'
      } else if (resolution.toLowerCase().includes('credentials') || 
                 resolution.toLowerCase().includes('wrong password')) {
        nextStepsText = '[NEXT_STEPS]: User entered incorrect credentials. Verify username/email and password. Use "Forgot Password" if needed. Check for CAPS LOCK being on.'
      } else if (status === 'OPEN' || status === 'PENDING') {
        nextStepsText = '[NEXT_STEPS]: This ticket is still open. Review the issue details and assign to appropriate support team member. Follow up with the user within 24 hours.'
      } else if (resolution) {
        // Generic next step for resolved issues
        nextStepsText = `[NEXT_STEPS]: ${resolution} Review this resolution to ensure the issue is fully addressed. If the problem recurs, create a new ticket with additional details.`
      }
      
      // Add next steps to the resolution field if we generated any
      if (nextStepsText && resolution) {
        enhancedRow.resolution = `${resolution} ${nextStepsText}`
        enhancedRow.RESOLUTION = `${resolution} ${nextStepsText}`
      } else if (nextStepsText && !resolution) {
        // If no resolution exists, add to a new field
        enhancedRow.next_steps = nextStepsText
      }
      
      return enhancedRow
    })
  }
  
  return data
}

// Security limits for input validation
const MAX_QUERY_LENGTH = 1000;
const MAX_DATABASE_ID_LENGTH = 100;
const MAX_CONTEXT_LENGTH = 2000;

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting to prevent API abuse
  const rateLimitResult = queryRateLimiter(request);
  if (rateLimitResult.blocked) {
    return NextResponse.json(
      { 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
      }, 
      { 
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)),
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.resetTime)
        }
      }
    );
  }

  const session: any = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { query, databaseId, context } = body

    // Basic validation
    if (!query || !databaseId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // SECURITY: Length validation to prevent resource exhaustion
    if (query.length > MAX_QUERY_LENGTH) {
      return NextResponse.json({ 
        error: `Query too long. Maximum ${MAX_QUERY_LENGTH} characters allowed.` 
      }, { status: 400 })
    }

    if (databaseId.length > MAX_DATABASE_ID_LENGTH) {
      return NextResponse.json({ 
        error: 'Invalid database ID format' 
      }, { status: 400 })
    }

    if (context && context.length > MAX_CONTEXT_LENGTH) {
      return NextResponse.json({ 
        error: `Context too long. Maximum ${MAX_CONTEXT_LENGTH} characters allowed.` 
      }, { status: 400 })
    }

    // Sanitize inputs
    const sanitizedQuery = query.trim();
    const sanitizedDatabaseId = databaseId.trim();

    if (sanitizedQuery.length === 0) {
      return NextResponse.json({ 
        error: 'Query cannot be empty' 
      }, { status: 400 })
    }

    // Get user's organization (use first one for now)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        ownedOrgs: { 
          select: { id: true },
          take: 1 
        },
        memberships: {
          select: { organizationId: true },
          take: 1
        }
      }
    })

    const organizationId = user?.ownedOrgs[0]?.id || user?.memberships[0]?.organizationId
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization found for user' }, { status: 400 })
    }

    // Get request metadata for audit logging
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Create audit log for query attempt
    await createAuditLog({
      organizationId,
      userId: session.user.id,
      action: 'QUERY_EXECUTE',
      resource: `database:${databaseId}`,
      details: { query, databaseId },
      ipAddress,
      userAgent,
      success: true
    })

    // Create query history entry
    const queryHistory = await prisma.queryHistory.create({
      data: {
        organizationId,
        userId: session.user.id,
        naturalQuery: query,
        databaseName: databaseId,
        status: 'PENDING',
      }
    })

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        
        try {
          // Determine database type and get appropriate configuration
          const dbConfig = getDatabaseConfig(databaseId)
          
          // Check cache first for consistent results
          const cachedSQL = getCachedSQL(query, databaseId);
          let finalResult: any;
          
          if (cachedSQL) {
            // Use cached SQL for consistent results
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ Using cached SQL (query hash:', query.substring(0, 20) + '...)');
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              status: 'processing',
              message: 'Using cached query translation...'
            })}\n\n`))
            
            finalResult = {
              success: true,
              sql: cachedSQL,
              summary: 'Query translated successfully (cached)'
            };
          } else {
            // Retrieve similar successful queries from vector database to improve SQL generation
            let similarQueries: any[] = [];
            try {
              similarQueries = await searchSimilarQueries(
                query,
                5, // Get top 5 similar queries
                {
                  database: { $eq: databaseId },
                  success: { $eq: true }
                }
              );
              console.log(`📚 Found ${similarQueries.length} similar successful queries for context`);
            } catch (error) {
              console.error('Failed to retrieve similar queries from vector DB:', error);
              // Continue without similar queries if vector DB fails
            }
            
            // Call LLM API to convert natural language to database-specific query
            console.log('🔄 Generating new SQL translation');
            
            // Create an AbortController with timeout to prevent hanging requests
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => {
              abortController.abort();
            }, 50000); // 50 second timeout
            
            let response;
            try {
              response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
                },
                body: JSON.stringify({
                  model: 'gpt-4.1-mini',
                  messages: [{
                    role: 'user',
                    content: generateQueryPrompt(query, databaseId, dbConfig, context, similarQueries)
                  }],
                  stream: true,
                  max_tokens: 3000,  // Increased for reasoning
                  temperature: 0,  // Deterministic SQL generation - same query = same SQL
                  response_format: { type: "json_object" }
                }),
                signal: abortController.signal,
              });
            } catch (fetchError: any) {
              clearTimeout(timeoutId);
              
              // Handle specific error types
              if (fetchError.name === 'AbortError') {
                console.error('LLM API request timed out after 50 seconds');
                throw new Error('Query processing timed out. Please try a simpler query or try again later.');
              }
              
              if (fetchError.cause?.code === 'ECONNREFUSED') {
                console.error('Connection to LLM API refused');
                throw new Error('Unable to connect to AI service. Please check your network connection and try again.');
              }
              
              console.error('LLM API fetch error:', fetchError);
              throw new Error(`Failed to connect to AI service: ${fetchError.message}`);
            }
            
            clearTimeout(timeoutId);

            // Check if the API call was successful
            if (!response.ok) {
              const errorText = await response.text();
              console.error('LLM API error:', response.status, errorText);
              throw new Error(`AI service error (${response.status}): ${errorText.substring(0, 200)}`);
            }

            const reader = response.body?.getReader()
            
            if (!reader) {
              throw new Error('No response body from LLM API');
            }
            const decoder = new TextDecoder()
            let buffer = ''
            let partialRead = ''

            // Send progress updates
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              status: 'processing',
              message: 'Converting natural language to SQL...'
            })}\n\n`))

            while (true) {
              const { done, value} = await reader?.read() || { done: true, value: undefined }
              if (done) break

              partialRead += decoder.decode(value, { stream: true })
              let lines = partialRead.split('\n')
              partialRead = lines.pop() || ''

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6)
                  if (data === '[DONE]') {
                    // Parse the complete JSON response
                    try {
                      finalResult = JSON.parse(buffer)
                      
                      // Normalize reasoning confidence from 0-100 to 0-1 range
                      if (finalResult.reasoning?.confidence !== undefined) {
                        finalResult.reasoning.confidence = finalResult.reasoning.confidence / 100;
                      }
                    } catch (parseError) {
                      console.error('JSON parse error:', parseError)
                      console.error('Buffer content:', buffer)
                      finalResult = { 
                        success: false, 
                        error: 'Failed to parse AI response' 
                      }
                    }
                    
                    // Cache the generated SQL for future queries
                    if (finalResult.success && finalResult.sql) {
                      cacheSQL(query, databaseId, finalResult.sql);
                      console.log('✅ Cached SQL for future use');
                    }
                    break;
                  }
                  
                  try {
                    const parsed = JSON.parse(data)
                    buffer += parsed.choices?.[0]?.delta?.content || ''
                    
                    // Send progress update
                    const progressData = JSON.stringify({
                      status: 'processing',
                      message: 'Analyzing query and generating response...'
                    })
                    controller.enqueue(encoder.encode(`data: ${progressData}\n\n`))
                  } catch (e) {
                    // Skip invalid JSON chunks
                  }
                }
              }
            }
          }
          
          // Execute the query against real database (applies to both cached and newly generated SQL)
          const queryResult = await executeQuery(databaseId, finalResult.sql || '', query)

                  // Convert BigInt values to strings for JSON serialization (for all nested objects)
                  const serializableQueryResult = convertBigIntToString(queryResult)

                  // Apply PII masking to query results
                  const maskedResults = maskQueryResults(serializableQueryResult.data)
                  
                  // Generate Next Steps for login/support queries
                  const enhancedResults = generateNextSteps(query, maskedResults)
                  
                  // Generate a summary of the actual results
                  const resultCount = queryResult.rowCount
                  const summaryText = finalResult.summary 
                    ? `${finalResult.summary} (Found ${resultCount} ${resultCount === 1 ? 'result' : 'results'})`
                    : `Query executed successfully. Found ${resultCount} ${resultCount === 1 ? 'result' : 'results'}.`
                  
                  // Detect PII in summary text
                  const { masked: maskedSummary, detected: piiTypes } = maskPII(summaryText)
                  const piiDetected = piiTypes.length > 0

                  // Update query history
                  await prisma.queryHistory.update({
                    where: { id: queryHistory.id },
                    data: {
                      generatedSql: finalResult.sql,
                      resultsSummary: finalResult.success ? maskedSummary : undefined,
                      status: finalResult.success ? 'SUCCESS' : 'ERROR',
                      errorMessage: finalResult.success ? undefined : finalResult.error,
                      executionTime: queryResult.executionTime,
                      results: enhancedResults,
                      piiDetected,
                      piiTypes: piiTypes.length > 0 ? piiTypes.join(',') : null
                    }
                  })

                  // Store in vector database for semantic search (fire and forget - don't block response)
                  if (finalResult.success && session.user.email) {
                    storeQueryPattern({
                      query: query,
                      sql: finalResult.sql || '',
                      database: databaseId,
                      databaseType: getDatabaseConfig(databaseId).type,
                      success: true,
                      executionTime: queryResult.executionTime,
                      rowCount: resultCount,
                      confidence: serializableQueryResult.confidence,
                      userId: session.user.email,
                      timestamp: new Date().toISOString()
                    }).catch(err => {
                      // Log but don't fail the query if vector storage fails
                      console.error('Failed to store query pattern in vector DB:', err)
                    })
                  }

                  // Send final result with reasoning
                  const finalData = JSON.stringify({
                    status: 'completed',
                    result: {
                      status: finalResult.success ? 'success' : 'error',
                      summary: maskedSummary,
                      sql: finalResult.sql,
                      data: enhancedResults,
                      error: finalResult.error,
                      executionTime: serializableQueryResult.executionTime,
                      piiDetected,
                      piiTypes,
                      confidence: finalResult.reasoning?.confidence || serializableQueryResult.confidence,
                      reasoning: finalResult.reasoning, // Chain-of-thought reasoning from LLM
                      suggestions: serializableQueryResult.suggestions,
                      visualization: serializableQueryResult.visualization
                    }
                  })

          controller.enqueue(encoder.encode(`data: ${finalData}\n\n`))
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
          controller.close()
          return
        } catch (error) {
          console.error('Query processing error:', error)
          
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          
          // Create audit log for failed query
          await createAuditLog({
            userId: session.user.id,
            action: 'QUERY_EXECUTE',
            resource: `database:${databaseId}`,
            details: { query, error: errorMessage },
            ipAddress,
            userAgent,
            success: false,
            errorMessage
          })
          
          // Update query history with error
          await prisma.queryHistory.update({
            where: { id: queryHistory.id },
            data: {
              status: 'ERROR',
              errorMessage
            }
          })

          // Send error to client with user-friendly message
          let userFriendlyError = errorMessage;
          
          // Convert technical errors to user-friendly messages
          if (errorMessage.includes('column') && errorMessage.includes('does not exist')) {
            userFriendlyError = "I couldn't find that information in the database. Try rephrasing your question or asking about different data.";
          } else if (errorMessage.includes('syntax error') || errorMessage.includes('invalid')) {
            userFriendlyError = "I had trouble understanding your question. Could you try rephrasing it? For example: 'Show me customers in California' or 'List all products'";
          } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
            userFriendlyError = "This query is taking too long. Try asking for a smaller dataset or be more specific.";
          } else if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
            userFriendlyError = "You don't have permission to access this data. Contact your administrator.";
          } else if (errorMessage.includes('connection') || errorMessage.includes('network')) {
            userFriendlyError = "Connection issue. Please check your internet and try again.";
          } else if (errorMessage.includes('AI service') || errorMessage.includes('LLM')) {
            userFriendlyError = "Our AI service is temporarily unavailable. Please try again in a moment.";
          }
          
          const errorData = JSON.stringify({
            status: 'error',
            result: {
              status: 'error',
              error: userFriendlyError,
              summary: 'Could not complete your request',
              technicalError: process.env.NODE_ENV === 'development' ? errorMessage : undefined
            }
          })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Database configuration interface
 */
interface DatabaseConfig {
  type: 'postgresql' | 'mysql' | 'sqlserver' | 'mongodb' | 'snowflake' | 'oracle' | 'mariadb'
  syntax: {
    columnQuotes: string
    tableQuotes: string
    limitClause: string
    dateFormat: string
  }
  schema: string
}

/**
 * Get database configuration based on database ID
 * For demo purposes, all databases use PostgreSQL (real implementation would detect from connection)
 */
function getDatabaseConfig(databaseId: string): DatabaseConfig {
  // In production, this would read from the database connection configuration
  // For now, we default to PostgreSQL for all demo databases
  return {
    type: 'postgresql',
    syntax: {
      columnQuotes: '"',
      tableQuotes: '',
      limitClause: 'LIMIT',
      dateFormat: 'YYYY-MM-DD'
    },
    schema: getDbSchema(databaseId, 'postgresql')
  }
}

/**
 * Generate database-specific query prompt with similar query patterns and chain-of-thought reasoning
 */
function generateQueryPrompt(
  query: string, 
  databaseId: string, 
  dbConfig: DatabaseConfig, 
  context?: { previousQuery: string; previousSql: string },
  similarQueries?: any[]
): string {
  const databaseInstructions = {
    postgresql: {
      expert: 'PostgreSQL expert',
      rules: `
1. ALWAYS use double quotes around column names: SELECT "firstName", "lastName" FROM sales_customers
2. Table names do NOT need quotes (they are snake_case)
3. Use LIMIT to restrict results (default LIMIT 10 for lists, LIMIT 100 for data queries)
4. Sort results logically: "top customers" = ORDER BY "totalSpent" DESC, "recent" = ORDER BY "createdAt" DESC
5. For aggregations, include proper GROUP BY clauses
6. Return meaningful columns based on the question
7. For geographic/location queries (customers by location, customers in a city/state/country, show map, etc.), ALWAYS include "firstName", "lastName", "email", city, state, country, "latitude", "longitude" columns for map visualization. Example: SELECT "firstName", "lastName", "email", city, state, country, "latitude", "longitude" FROM sales_customers WHERE state = 'TX'
8. CRITICAL STATE NAME CONVERSION: US state names in database are ONLY 2-letter codes (CA, TX, NY, FL, etc.). When users mention full state names like "California", "Texas", "New York", "Florida", you MUST convert them:
   - California → CA
   - Texas → TX
   - New York → NY
   - Florida → FL
   - Illinois → IL
   - Pennsylvania → PA
   - Ohio → OH
   - Georgia → GA
   - North Carolina → NC
   - Michigan → MI
   - New Jersey → NJ
   - Virginia → VA
   - Washington → WA
   - Arizona → AZ
   - Massachusetts → MA
   - Tennessee → TN
   - Indiana → IN
   - Maryland → MD
   - Missouri → MO
   - Wisconsin → WI
   - Colorado → CO
   - Minnesota → MN
   - South Carolina → SC
   - Alabama → AL
   - Louisiana → LA
   - Kentucky → KY
   - Oregon → OR
   - Oklahoma → OK
   - Connecticut → CT
   - Utah → UT
   - Iowa → IA
   - Nevada → NV
   - Arkansas → AR
   - Mississippi → MS
   - Kansas → KS
   - New Mexico → NM
   - Nebraska → NE
   - Idaho → ID
   - West Virginia → WV
   - Hawaii → HI
   - New Hampshire → NH
   - Maine → ME
   - Montana → MT
   - Rhode Island → RI
   - Delaware → DE
   - South Dakota → SD
   - North Dakota → ND
   - Alaska → AK
   - Vermont → VT
   - Wyoming → WY
9. For simple list/count queries, keep it simple. Don't use complicated JOINs unless necessary.`,
      examples: `
- "Show top 5 customers" → SELECT "firstName", "lastName", "email", "totalSpent" FROM sales_customers ORDER BY "totalSpent" DESC LIMIT 5
- "List all products" → SELECT "name", "price", "category", "stockLevel" FROM sales_products LIMIT 100
- "Show customers by location" → SELECT "firstName", "lastName", "email", city, state, country, "latitude", "longitude" FROM sales_customers WHERE "latitude" IS NOT NULL LIMIT 100
- "How many customers live in Texas" → SELECT COUNT(*) as customer_count, 'Texas' as state_name FROM sales_customers WHERE state = 'TX'
- "Show customers in California" → SELECT "firstName", "lastName", "email", city, state, country, "latitude", "longitude" FROM sales_customers WHERE state = 'CA' LIMIT 100
- "Show customers in Texas" → SELECT "firstName", "lastName", "email", city, state, country, "latitude", "longitude" FROM sales_customers WHERE state = 'TX' LIMIT 100
- "Who are our customers in New York" → SELECT "firstName", "lastName", "email", city, state, "latitude", "longitude" FROM sales_customers WHERE state = 'NY' LIMIT 100`
    },
    mysql: {
      expert: 'MySQL expert',
      rules: `
1. Use backticks around column names: SELECT \`firstName\`, \`lastName\` FROM sales_customers
2. Use backticks around table names if they contain reserved words
3. Use LIMIT to restrict results (default LIMIT 10 for lists, LIMIT 100 for data queries)
4. Sort results logically
5. For aggregations, include proper GROUP BY clauses
6. Return meaningful columns based on the question
7. For geographic queries, return latitude and longitude columns`,
      examples: `
- "Show top 5 customers" → SELECT \`firstName\`, \`lastName\`, \`email\`, \`totalSpent\` FROM sales_customers ORDER BY \`totalSpent\` DESC LIMIT 5
- "List all products" → SELECT \`name\`, \`price\`, \`category\`, \`stockLevel\` FROM sales_products LIMIT 100`
    },
    mongodb: {
      expert: 'MongoDB expert',
      rules: `
1. Generate MongoDB aggregation pipeline syntax
2. Use proper operators: $match, $sort, $limit, $group, $project
3. Field names do NOT need quotes in the pipeline
4. Use proper MongoDB query syntax
5. Return meaningful fields based on the question
6. For geographic queries, return latitude and longitude fields`,
      examples: `
- "Show top 5 customers" → db.sales_customers.find().sort({totalSpent: -1}).limit(5).project({firstName: 1, lastName: 1, email: 1, totalSpent: 1})
- "List all products" → db.sales_products.find().limit(100).project({name: 1, price: 1, category: 1, stockLevel: 1})`
    },
    sqlserver: {
      expert: 'SQL Server (T-SQL) expert',
      rules: `
1. Use square brackets around identifiers: SELECT [firstName], [lastName] FROM sales_customers
2. Use TOP clause instead of LIMIT: SELECT TOP 10 * FROM table
3. Sort results logically
4. For aggregations, include proper GROUP BY clauses
5. Return meaningful columns based on the question
6. For geographic queries, return latitude and longitude columns`,
      examples: `
- "Show top 5 customers" → SELECT TOP 5 [firstName], [lastName], [email], [totalSpent] FROM sales_customers ORDER BY [totalSpent] DESC
- "List all products" → SELECT TOP 100 [name], [price], [category], [stockLevel] FROM sales_products`
    },
    snowflake: {
      expert: 'Snowflake expert',
      rules: `
1. Use double quotes around identifiers: SELECT "firstName", "lastName" FROM sales_customers
2. Use LIMIT clause for result restriction
3. Snowflake is case-insensitive but preserves case with quotes
4. Sort results logically
5. For aggregations, include proper GROUP BY clauses
6. For geographic queries, return latitude and longitude columns`,
      examples: `
- "Show top 5 customers" → SELECT "firstName", "lastName", "email", "totalSpent" FROM sales_customers ORDER BY "totalSpent" DESC LIMIT 5
- "List all products" → SELECT "name", "price", "category", "stockLevel" FROM sales_products LIMIT 100`
    },
    oracle: {
      expert: 'Oracle SQL expert',
      rules: `
1. Use double quotes around identifiers for case-sensitivity
2. Use ROWNUM or FETCH FIRST for result restriction
3. Sort results logically
4. For aggregations, include proper GROUP BY clauses
5. Return meaningful columns based on the question
6. For geographic queries, return latitude and longitude columns`,
      examples: `
- "Show top 5 customers" → SELECT "firstName", "lastName", "email", "totalSpent" FROM sales_customers ORDER BY "totalSpent" DESC FETCH FIRST 5 ROWS ONLY
- "List all products" → SELECT "name", "price", "category", "stockLevel" FROM sales_products FETCH FIRST 100 ROWS ONLY`
    },
    mariadb: {
      expert: 'MariaDB expert',
      rules: `
1. Use backticks around column names: SELECT \`firstName\`, \`lastName\` FROM sales_customers
2. Use backticks around table names if they contain reserved words
3. Use LIMIT to restrict results (default LIMIT 10 for lists, LIMIT 100 for data queries)
4. Sort results logically
5. For aggregations, include proper GROUP BY clauses
6. Return meaningful columns based on the question
7. For geographic queries, return latitude and longitude columns`,
      examples: `
- "Show top 5 customers" → SELECT \`firstName\`, \`lastName\`, \`email\`, \`totalSpent\` FROM sales_customers ORDER BY \`totalSpent\` DESC LIMIT 5
- "List all products" → SELECT \`name\`, \`price\`, \`category\`, \`stockLevel\` FROM sales_products LIMIT 100`
    }
  }

  const dbType = dbConfig.type
  const instructions = databaseInstructions[dbType] || databaseInstructions.postgresql

  let contextSection = ''
  if (context?.previousQuery && context?.previousSql) {
    contextSection = `

IMPORTANT - CONVERSATIONAL CONTEXT:
This is a follow-up question. The previous query was:
User asked: "${context.previousQuery}"
You generated: ${context.previousSql}

The current question "${query}" is related to the previous one. 
CRITICAL: Pay attention to how the previous query was structured:
- If the previous query used LIMIT 1 (to show just one result), and the current question is asking for a similar thing (like "the lowest" after "the highest"), you MUST also use LIMIT 1
- If the previous query showed "the top" or "the highest" with LIMIT 1, and now they're asking for "the lowest" or "the bottom", generate a similar query with LIMIT 1
- Follow-up questions like "And the lowest?", "What about the minimum?", "And the bottom one?" should mirror the structure of the previous query (especially LIMIT clauses)
- Maintain consistency in column selection and ordering

EXAMPLES OF FOLLOW-UPS:
- Previous: "who has the highest salary" → SELECT ... ORDER BY salary DESC LIMIT 1
- Current: "And the lowest?" → SELECT ... ORDER BY salary ASC LIMIT 1  (NOT just ORDER BY without LIMIT!)
- Previous: "show top 5 customers" → SELECT ... ORDER BY ... DESC LIMIT 5
- Current: "what about bottom 5?" → SELECT ... ORDER BY ... ASC LIMIT 5
`
  }

  // Build similar queries section for learning from past successes
  let similarQueriesSection = ''
  if (similarQueries && similarQueries.length > 0) {
    const examples = similarQueries
      .filter(q => q.score > 0.75) // Only use highly relevant examples
      .slice(0, 3) // Limit to top 3
      .map((q, idx) => {
        return `Example ${idx + 1} (Similarity: ${(q.score * 100).toFixed(1)}%):
  User Question: "${q.metadata.query}"
  Generated SQL: ${q.metadata.sql}
  Result: Success (${q.metadata.rowCount || 0} rows returned)`
      })
      .join('\n\n')

    if (examples) {
      similarQueriesSection = `

🎯 LEARNED PATTERNS - Similar Successful Queries:
The system has successfully handled similar queries before. Use these as reference:

${examples}

These examples show proven patterns for this database. Follow similar approaches when applicable.
`
    }
  }

  return `You are a ${instructions.expert}. Convert the following natural language query into a valid ${dbType.toUpperCase()} query.

IMPORTANT: You must provide CHAIN-OF-THOUGHT REASONING to explain your thinking process.

Database: ${databaseId}
Database Type: ${dbType.toUpperCase()}

Available tables and schemas:
${dbConfig.schema}
${contextSection}
${similarQueriesSection}

User Question: "${query}"

CRITICAL RULES FOR ${dbType.toUpperCase()}:
${instructions.rules}

EXAMPLE QUERIES:
${instructions.examples}

CHAIN-OF-THOUGHT REASONING INSTRUCTIONS:
Before generating the SQL, explain your reasoning process step by step:
1. What is the user trying to find?
2. Which tables and columns are needed?
3. What JOINs are required (if any)?
4. What filtering conditions should be applied?
5. How should the results be sorted and limited?
6. What is the confidence level in this approach (0-100%)?

Please respond in JSON format:
{
  "reasoning": {
    "understanding": "What the user is asking for",
    "tables": ["list", "of", "tables", "needed"],
    "joins": "Explanation of any JOINs required",
    "filters": "Filtering conditions to apply",
    "sorting": "How to sort the results",
    "confidence": 95
  },
  "sql": "YOUR_GENERATED_QUERY_HERE",
  "summary": "Brief description of what this query returns",
  "success": true
}

If there's an error:
{
  "reasoning": {
    "understanding": "What went wrong",
    "issue": "Description of the issue",
    "confidence": 0
  },
  "error": "Error message",
  "success": false
}

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`
}

/**
 * Get database schema for specific database type with sample data
 */
function getDbSchema(databaseId: string, dbType: string): string {
  const columnQuote = dbType === 'postgresql' || dbType === 'snowflake' ? '"' : dbType === 'mysql' || dbType === 'mariadb' ? '`' : dbType === 'sqlserver' ? '[' : ''
  const endQuote = dbType === 'sqlserver' ? ']' : columnQuote

  const schemas = {
    sales: `
    Tables (use ${columnQuote}${endQuote} for column names):
    
    📊 sales_customers (Customer information and contact details)
    Columns: ${columnQuote}id${endQuote}, ${columnQuote}firstName${endQuote}, ${columnQuote}lastName${endQuote}, ${columnQuote}email${endQuote}, ${columnQuote}phone${endQuote}, ${columnQuote}address${endQuote}, ${columnQuote}city${endQuote}, ${columnQuote}state${endQuote} (US state codes like CA, TX, NY, FL, etc.), ${columnQuote}country${endQuote}, ${columnQuote}zipCode${endQuote}, ${columnQuote}latitude${endQuote}, ${columnQuote}longitude${endQuote}, ${columnQuote}dateJoined${endQuote}, ${columnQuote}totalSpent${endQuote}
    Sample Data:
      - firstName: "John", "Sarah", "Michael", "Jennifer"
      - state: ONLY 2-letter codes stored - "CA", "TX", "NY", "FL" (NEVER full names like "California" or "Texas")
      - totalSpent: ranges from 0 to 50000
      - latitude/longitude: available for map visualizations
      - IMPORTANT: When querying by state, users may say "California" but you MUST convert to "CA" in the WHERE clause
    
    📊 sales_companies (Business customers and enterprise accounts)
    Columns: ${columnQuote}id${endQuote}, ${columnQuote}companyName${endQuote}, ${columnQuote}industry${endQuote}, ${columnQuote}contactName${endQuote}, ${columnQuote}email${endQuote}, ${columnQuote}phone${endQuote}, ${columnQuote}address${endQuote}, ${columnQuote}city${endQuote}, ${columnQuote}state${endQuote}, ${columnQuote}country${endQuote}, ${columnQuote}zipCode${endQuote}, ${columnQuote}website${endQuote}, ${columnQuote}employeeCount${endQuote}, ${columnQuote}annualRevenue${endQuote}, ${columnQuote}lifetimeValue${endQuote}, ${columnQuote}contractValue${endQuote}, ${columnQuote}dateJoined${endQuote}, ${columnQuote}status${endQuote}, ${columnQuote}tier${endQuote}
    Sample Data:
      - companyName: "TechCorp", "GlobalSolutions", "InnovateCo"
      - industry: "Technology", "Manufacturing", "Healthcare", "Finance"
      - status: "ACTIVE", "INACTIVE", "CHURNED" (IMPORTANT: CustomerStatus enum values MUST be in UPPERCASE)
      - tier: "Standard", "Professional", "Enterprise"
    
    📊 sales_products (Product catalog with pricing and inventory)
    Columns: ${columnQuote}id${endQuote}, ${columnQuote}name${endQuote}, ${columnQuote}description${endQuote}, ${columnQuote}price${endQuote}, ${columnQuote}category${endQuote}, ${columnQuote}sku${endQuote}, ${columnQuote}stockLevel${endQuote}, ${columnQuote}createdAt${endQuote}
    Sample Data:
      - name: "Wireless Mouse", "USB Keyboard", "4K Monitor"
      - category: "Electronics", "Accessories", "Computers"
      - price: ranges from 9.99 to 2999.99
    
    📊 sales_orders (Customer orders and transactions)
    Columns: ${columnQuote}id${endQuote}, ${columnQuote}orderNumber${endQuote}, ${columnQuote}customerId${endQuote} (FOREIGN KEY to sales_customers.id), ${columnQuote}orderDate${endQuote}, ${columnQuote}status${endQuote}, ${columnQuote}totalAmount${endQuote}, ${columnQuote}shippingCost${endQuote}, ${columnQuote}taxAmount${endQuote}
    Sample Data:
      - status: "PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED" (IMPORTANT: OrderStatus enum values MUST be in UPPERCASE)
      - totalAmount: ranges from 10 to 5000
    
    CRITICAL ENUM CONSTRAINT:
    The status column uses an OrderStatus enum type. ALWAYS use UPPERCASE values:
    - Use 'PENDING' NOT 'Pending' or 'pending'
    - Use 'PROCESSING' NOT 'Processing' or 'processing'  
    - Use 'SHIPPED' NOT 'Shipped' or 'shipped'
    - Use 'DELIVERED' NOT 'Delivered' or 'delivered'
    - Use 'CANCELLED' NOT 'Cancelled' or 'cancelled'
    
    📊 sales_order_items (Individual items within orders)
    Columns: ${columnQuote}id${endQuote}, ${columnQuote}orderId${endQuote} (FOREIGN KEY to sales_orders.id), ${columnQuote}productId${endQuote} (FOREIGN KEY to sales_products.id), ${columnQuote}quantity${endQuote}, ${columnQuote}unitPrice${endQuote}, ${columnQuote}totalPrice${endQuote}
    
    RELATIONSHIPS:
    - To get customer details for orders, JOIN sales_customers c ON o.${columnQuote}customerId${endQuote} = c.${columnQuote}id${endQuote}
    - To get product details for order items, JOIN sales_products p ON oi.${columnQuote}productId${endQuote} = p.${columnQuote}id${endQuote}
    - To get order details for order items, JOIN sales_orders o ON oi.${columnQuote}orderId${endQuote} = o.${columnQuote}id${endQuote}
    
    CRITICAL: When querying sales_orders, if customer information is relevant, include customer names by joining with sales_customers.
    When querying sales_order_items, ALWAYS include product names by joining with sales_products.
    
    EXAMPLE QUERIES FOR SALES:
    - "Show recent orders" → SELECT o.${columnQuote}orderNumber${endQuote}, c.${columnQuote}firstName${endQuote}, c.${columnQuote}lastName${endQuote}, o.${columnQuote}orderDate${endQuote}, o.${columnQuote}totalAmount${endQuote}, o.${columnQuote}status${endQuote} FROM sales_orders o JOIN sales_customers c ON o.${columnQuote}customerId${endQuote} = c.${columnQuote}id${endQuote} ORDER BY o.${columnQuote}orderDate${endQuote} DESC LIMIT 50
    - "What did customer X order?" → SELECT o.${columnQuote}orderNumber${endQuote}, p.${columnQuote}name${endQuote} as product_name, oi.${columnQuote}quantity${endQuote}, oi.${columnQuote}unitPrice${endQuote}, o.${columnQuote}orderDate${endQuote} FROM sales_orders o JOIN sales_customers c ON o.${columnQuote}customerId${endQuote} = c.${columnQuote}id${endQuote} JOIN sales_order_items oi ON o.${columnQuote}id${endQuote} = oi.${columnQuote}orderId${endQuote} JOIN sales_products p ON oi.${columnQuote}productId${endQuote} = p.${columnQuote}id${endQuote} WHERE c.${columnQuote}firstName${endQuote} = 'X' LIMIT 100
    `,
    hr: `
    Tables (use ${columnQuote}${endQuote} for column names):
    
    📊 hr_departments (Organizational departments)
    Columns: ${columnQuote}id${endQuote}, ${columnQuote}name${endQuote}, ${columnQuote}description${endQuote}, ${columnQuote}budget${endQuote}, ${columnQuote}managerId${endQuote}
    Sample Data:
      - name: "Engineering", "Sales", "Marketing", "HR", "Finance"
      - budget: ranges from 50000 to 500000
    
    📊 hr_employees (Employee information and employment details)
    Columns: ${columnQuote}id${endQuote}, ${columnQuote}employeeId${endQuote}, ${columnQuote}firstName${endQuote}, ${columnQuote}lastName${endQuote}, ${columnQuote}email${endQuote}, ${columnQuote}phone${endQuote}, ${columnQuote}gender${endQuote}, ${columnQuote}position${endQuote}, ${columnQuote}departmentId${endQuote} (FOREIGN KEY to hr_departments.id), ${columnQuote}salary${endQuote}, ${columnQuote}hireDate${endQuote}, ${columnQuote}status${endQuote}
    Sample Data:
      - position: "Software Engineer", "Sales Manager", "Marketing Director", "HR Specialist"
      - salary: ranges from 40000 to 250000
      - status: "ACTIVE", "INACTIVE", "TERMINATED", "ON_LEAVE" (IMPORTANT: EmployeeStatus enum values MUST be in UPPERCASE with underscores)
      - gender: "Male", "Female", "Non-binary", "Prefer not to say"
    
    📊 hr_performance (Employee performance reviews)
    Columns: ${columnQuote}id${endQuote}, ${columnQuote}employeeId${endQuote} (FOREIGN KEY to hr_employees.id), ${columnQuote}reviewDate${endQuote}, ${columnQuote}rating${endQuote}, ${columnQuote}goals${endQuote}, ${columnQuote}feedback${endQuote}, ${columnQuote}reviewer${endQuote}
    Sample Data:
      - rating: 1 to 5 (1=Poor, 5=Excellent)
      - reviewer: Manager names
    
    RELATIONSHIPS:
    - To get department details for employees, JOIN hr_departments d ON e.${columnQuote}departmentId${endQuote} = d.${columnQuote}id${endQuote}
    - To get employee details for performance reviews, JOIN hr_employees e ON p.${columnQuote}employeeId${endQuote} = e.${columnQuote}id${endQuote}
    
    CRITICAL: When querying hr_employees, if showing departmentId is needed, ALWAYS include the department name by joining with hr_departments.
    
    EXAMPLE QUERIES FOR HR:
    - "Show all employees" → SELECT e.${columnQuote}firstName${endQuote}, e.${columnQuote}lastName${endQuote}, e.${columnQuote}position${endQuote}, d.${columnQuote}name${endQuote} as department_name, e.${columnQuote}salary${endQuote}, e.${columnQuote}hireDate${endQuote} FROM hr_employees e JOIN hr_departments d ON e.${columnQuote}departmentId${endQuote} = d.${columnQuote}id${endQuote} LIMIT 100
    - "Who has the highest salary" → SELECT e.${columnQuote}firstName${endQuote}, e.${columnQuote}lastName${endQuote}, e.${columnQuote}position${endQuote}, d.${columnQuote}name${endQuote} as department_name, e.${columnQuote}salary${endQuote} FROM hr_employees e JOIN hr_departments d ON e.${columnQuote}departmentId${endQuote} = d.${columnQuote}id${endQuote} ORDER BY e.${columnQuote}salary${endQuote} DESC LIMIT 1
    - "Show employees by department" → SELECT d.${columnQuote}name${endQuote} as department_name, e.${columnQuote}firstName${endQuote}, e.${columnQuote}lastName${endQuote}, e.${columnQuote}position${endQuote} FROM hr_employees e JOIN hr_departments d ON e.${columnQuote}departmentId${endQuote} = d.${columnQuote}id${endQuote} ORDER BY d.${columnQuote}name${endQuote}, e.${columnQuote}lastName${endQuote} LIMIT 100
    - "How many men/women on the team" → SELECT ${columnQuote}gender${endQuote}, COUNT(*) as count FROM hr_employees GROUP BY ${columnQuote}gender${endQuote}
    - "Show male employees in Engineering" → SELECT e.${columnQuote}firstName${endQuote}, e.${columnQuote}lastName${endQuote}, e.${columnQuote}position${endQuote}, e.${columnQuote}gender${endQuote} FROM hr_employees e JOIN hr_departments d ON e.${columnQuote}departmentId${endQuote} = d.${columnQuote}id${endQuote} WHERE e.${columnQuote}gender${endQuote} = 'Male' AND d.${columnQuote}name${endQuote} = 'Engineering' LIMIT 100
    `,
    inventory: `
    Tables (use ${columnQuote}${endQuote} for column names):
    
    📊 inv_warehouses (Warehouse locations and capacity)
    Columns: ${columnQuote}id${endQuote}, ${columnQuote}name${endQuote}, ${columnQuote}address${endQuote}, ${columnQuote}city${endQuote}, ${columnQuote}state${endQuote}, ${columnQuote}country${endQuote}, ${columnQuote}capacity${endQuote}, ${columnQuote}managerId${endQuote}
    Sample Data:
      - name: "Main Warehouse", "East Coast Distribution", "West Coast Hub"
      - capacity: ranges from 10000 to 100000
    
    📊 inv_suppliers (Product suppliers and vendors)
    Columns: ${columnQuote}id${endQuote}, ${columnQuote}name${endQuote}, ${columnQuote}contactName${endQuote}, ${columnQuote}email${endQuote}, ${columnQuote}phone${endQuote}, ${columnQuote}address${endQuote}, ${columnQuote}city${endQuote}, ${columnQuote}state${endQuote}, ${columnQuote}country${endQuote}
    Sample Data:
      - name: "Global Supplies Inc", "Tech Parts Co", "Premium Materials Ltd"
    
    📊 inv_products (Product catalog for inventory)
    Columns: ${columnQuote}id${endQuote}, ${columnQuote}name${endQuote}, ${columnQuote}description${endQuote}, ${columnQuote}sku${endQuote}, ${columnQuote}category${endQuote}, ${columnQuote}unitPrice${endQuote}, ${columnQuote}supplierId${endQuote} (FOREIGN KEY to inv_suppliers.id), ${columnQuote}minStock${endQuote}, ${columnQuote}maxStock${endQuote}
    Sample Data:
      - category: "Electronics", "Furniture", "Office Supplies"
      - sku: "SKU-001", "SKU-002", etc.
    
    📊 inv_inventory (Current inventory levels by warehouse)
    Columns: ${columnQuote}id${endQuote}, ${columnQuote}productId${endQuote} (FOREIGN KEY to inv_products.id), ${columnQuote}warehouseId${endQuote} (FOREIGN KEY to inv_warehouses.id), ${columnQuote}quantity${endQuote}, ${columnQuote}reservedQty${endQuote}, ${columnQuote}lastUpdated${endQuote}
    Sample Data:
      - quantity: ranges from 0 to 10000
      - reservedQty: items reserved for pending orders
    
    RELATIONSHIPS:
    - To get product details from inventory, JOIN inv_products p ON i.${columnQuote}productId${endQuote} = p.${columnQuote}id${endQuote}
    - To get warehouse details from inventory, JOIN inv_warehouses w ON i.${columnQuote}warehouseId${endQuote} = w.${columnQuote}id${endQuote}
    - To get supplier details from products, JOIN inv_suppliers s ON p.${columnQuote}supplierId${endQuote} = s.${columnQuote}id${endQuote}
    
    CRITICAL: When querying inv_inventory, ALWAYS include product names and warehouse names by joining with the respective tables.
    NEVER return just productId or warehouseId without the corresponding names.
    
    EXAMPLE QUERIES FOR INVENTORY:
    - "Show inventory levels" → SELECT p.${columnQuote}name${endQuote} as product_name, w.${columnQuote}name${endQuote} as warehouse_name, i.${columnQuote}quantity${endQuote}, i.${columnQuote}reservedQty${endQuote} FROM inv_inventory i JOIN inv_products p ON i.${columnQuote}productId${endQuote} = p.${columnQuote}id${endQuote} JOIN inv_warehouses w ON i.${columnQuote}warehouseId${endQuote} = w.${columnQuote}id${endQuote} LIMIT 100
    - "What products are low on stock?" → SELECT p.${columnQuote}name${endQuote} as product_name, p.${columnQuote}sku${endQuote}, i.${columnQuote}quantity${endQuote}, p.${columnQuote}minStock${endQuote}, w.${columnQuote}name${endQuote} as warehouse_name FROM inv_inventory i JOIN inv_products p ON i.${columnQuote}productId${endQuote} = p.${columnQuote}id${endQuote} JOIN inv_warehouses w ON i.${columnQuote}warehouseId${endQuote} = w.${columnQuote}id${endQuote} WHERE i.${columnQuote}quantity${endQuote} < p.${columnQuote}minStock${endQuote} LIMIT 100
    - "Show products from each supplier" → SELECT s.${columnQuote}name${endQuote} as supplier_name, p.${columnQuote}name${endQuote} as product_name, p.${columnQuote}category${endQuote}, p.${columnQuote}unitPrice${endQuote} FROM inv_products p JOIN inv_suppliers s ON p.${columnQuote}supplierId${endQuote} = s.${columnQuote}id${endQuote} ORDER BY s.${columnQuote}name${endQuote} LIMIT 100
    - "Which warehouse has the most inventory?" → SELECT w.${columnQuote}name${endQuote} as warehouse_name, SUM(i.${columnQuote}quantity${endQuote}) as total_quantity FROM inv_inventory i JOIN inv_warehouses w ON i.${columnQuote}warehouseId${endQuote} = w.${columnQuote}id${endQuote} GROUP BY w.${columnQuote}id${endQuote}, w.${columnQuote}name${endQuote} ORDER BY total_quantity DESC LIMIT 10
    `,
    finance: `
    Tables (use ${columnQuote}${endQuote} for column names):
    - fin_accounts: ${columnQuote}id${endQuote}, ${columnQuote}accountName${endQuote}, ${columnQuote}accountType${endQuote}, ${columnQuote}balance${endQuote}, ${columnQuote}currency${endQuote}, ${columnQuote}isActive${endQuote}, ${columnQuote}createdAt${endQuote}
    - fin_transactions: ${columnQuote}id${endQuote}, ${columnQuote}accountId${endQuote}, ${columnQuote}amount${endQuote}, ${columnQuote}type${endQuote}, ${columnQuote}category${endQuote}, ${columnQuote}description${endQuote}, ${columnQuote}reference${endQuote}, ${columnQuote}transactionDate${endQuote}, ${columnQuote}createdAt${endQuote}
    - fin_budgets: ${columnQuote}id${endQuote}, ${columnQuote}category${endQuote}, ${columnQuote}budgetYear${endQuote}, ${columnQuote}budgetMonth${endQuote}, ${columnQuote}allocated${endQuote}, ${columnQuote}spent${endQuote}, ${columnQuote}remaining${endQuote}, ${columnQuote}createdAt${endQuote}
    `,
    customer_support: `
    Tables (use ${columnQuote}${endQuote} for column names):
    - cust_customers: ${columnQuote}id${endQuote}, ${columnQuote}firstName${endQuote}, ${columnQuote}lastName${endQuote}, ${columnQuote}email${endQuote}, ${columnQuote}phone${endQuote}, ${columnQuote}company${endQuote}, ${columnQuote}tier${endQuote}, ${columnQuote}status${endQuote}, ${columnQuote}joinDate${endQuote}, ${columnQuote}lastContact${endQuote}
      Sample Data:
        - tier: "BASIC", "STANDARD", "PREMIUM", "ENTERPRISE" (IMPORTANT: CustomerTier enum MUST be in UPPERCASE)
        - status: "ACTIVE", "INACTIVE", "CHURNED" (IMPORTANT: CustomerStatus enum MUST be in UPPERCASE)
    
    - cust_tickets: ${columnQuote}id${endQuote}, ${columnQuote}ticketNumber${endQuote}, ${columnQuote}customerId${endQuote} (FOREIGN KEY to cust_customers.id), ${columnQuote}subject${endQuote}, ${columnQuote}description${endQuote}, ${columnQuote}priority${endQuote}, ${columnQuote}status${endQuote}, ${columnQuote}assignedTo${endQuote}, ${columnQuote}category${endQuote}, ${columnQuote}resolution${endQuote}, ${columnQuote}createdAt${endQuote}, ${columnQuote}updatedAt${endQuote}, ${columnQuote}resolvedAt${endQuote}
      Sample Data:
        - priority: "LOW", "MEDIUM", "HIGH", "CRITICAL" (IMPORTANT: TicketPriority enum MUST be in UPPERCASE)
        - status: "OPEN", "IN_PROGRESS", "PENDING_CUSTOMER", "RESOLVED", "CLOSED" (IMPORTANT: TicketStatus enum MUST be in UPPERCASE with underscores)
    
    - cust_interactions: ${columnQuote}id${endQuote}, ${columnQuote}customerId${endQuote} (FOREIGN KEY to cust_customers.id), ${columnQuote}ticketId${endQuote} (FOREIGN KEY to cust_tickets.id), ${columnQuote}type${endQuote}, ${columnQuote}channel${endQuote}, ${columnQuote}subject${endQuote}, ${columnQuote}notes${endQuote}, ${columnQuote}agentName${endQuote}, ${columnQuote}duration${endQuote}, ${columnQuote}createdAt${endQuote}
    
    RELATIONSHIPS:
    - To get tickets for a customer, JOIN cust_tickets t ON t.${columnQuote}customerId${endQuote} = c.${columnQuote}id${endQuote}
    - To get customer info for a ticket, JOIN cust_customers c ON t.${columnQuote}customerId${endQuote} = c.${columnQuote}id${endQuote}
    
    EXAMPLE QUERIES FOR CUSTOMER SUPPORT:
    - "Show tickets for Jennifer Smith" → SELECT t.${columnQuote}ticketNumber${endQuote}, t.${columnQuote}subject${endQuote}, t.${columnQuote}status${endQuote}, t.${columnQuote}priority${endQuote}, t.${columnQuote}createdAt${endQuote} FROM cust_tickets t JOIN cust_customers c ON t.${columnQuote}customerId${endQuote} = c.${columnQuote}id${endQuote} WHERE c.${columnQuote}firstName${endQuote} = 'Jennifer' AND c.${columnQuote}lastName${endQuote} = 'Smith'
    - "Why did Jennifer Smith have trouble logging in?" → SELECT t.${columnQuote}ticketNumber${endQuote}, t.${columnQuote}subject${endQuote}, t.${columnQuote}description${endQuote}, t.${columnQuote}resolution${endQuote}, t.${columnQuote}status${endQuote}, t.${columnQuote}createdAt${endQuote} FROM cust_tickets t JOIN cust_customers c ON t.${columnQuote}customerId${endQuote} = c.${columnQuote}id${endQuote} WHERE c.${columnQuote}firstName${endQuote} = 'Jennifer' AND c.${columnQuote}lastName${endQuote} = 'Smith' AND (t.${columnQuote}subject${endQuote} ILIKE '%login%' OR t.${columnQuote}description${endQuote} ILIKE '%login%')
    - "Show open tickets" → SELECT ${columnQuote}ticketNumber${endQuote}, ${columnQuote}subject${endQuote}, ${columnQuote}priority${endQuote}, ${columnQuote}createdAt${endQuote} FROM cust_tickets WHERE ${columnQuote}status${endQuote} = 'OPEN' ORDER BY ${columnQuote}createdAt${endQuote} DESC LIMIT 50
    `
  }
  
  return schemas[databaseId as keyof typeof schemas] || ''
}
