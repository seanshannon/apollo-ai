/**
 * Restricted execution path for LLM-generated SQL
 *
 * Generated SQL never runs on the application's main connection. It runs on a
 * dedicated pg pool whose connection string (QUERY_DATABASE_URL) should point
 * at the `apollo_query_readonly` role created by
 * prisma/sql/setup-readonly-role.sql — a role with SELECT granted only on the
 * demo dataset tables, and nothing else.
 *
 * Independent of the role, every execution is:
 *   - wrapped in a READ ONLY transaction (blocks writes at the DB level)
 *   - given a statement timeout
 *   - bounded to MAX_RESULT_ROWS via a SERVER-SIDE CURSOR, so the driver never
 *     pulls more than maxRows+1 rows into process memory no matter how many
 *     the query would produce (a bare `LIMIT` cannot be appended safely to an
 *     arbitrary validated SELECT/UNION/CTE, and wrapping in a subquery breaks
 *     JOINs with duplicate output column names — the cursor avoids both).
 *
 * So even if QUERY_DATABASE_URL is misconfigured to a privileged role,
 * generated SQL cannot write, cannot run forever, and cannot exhaust memory
 * or exfiltrate unbounded data in one call.
 */

import { Pool, PoolClient } from 'pg'
import Cursor from 'pg-cursor'

const DEFAULT_TIMEOUT_MS = 15_000
export const MAX_RESULT_ROWS = 1_000

const globalForQueryPool = globalThis as unknown as {
  queryPool: Pool | undefined
}

function createQueryPool(): Pool {
  const connectionString = process.env.QUERY_DATABASE_URL || process.env.DATABASE_URL
  if (!process.env.QUERY_DATABASE_URL) {
    console.warn(
      '[query-db] QUERY_DATABASE_URL is not set — generated SQL will run on the main ' +
        'database role. Create the restricted role (prisma/sql/setup-readonly-role.sql) ' +
        'and set QUERY_DATABASE_URL to use it. READ ONLY transactions, timeouts, and the ' +
        'row cap still apply, but table-level isolation depends on the restricted role.'
    )
  }
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })
  pool.on('error', (err) => {
    console.error('[query-db] Pool error:', err.message)
  })
  return pool
}

const queryPool: Pool = globalForQueryPool.queryPool ?? createQueryPool()
if (process.env.NODE_ENV !== 'production') globalForQueryPool.queryPool = queryPool

export interface GeneratedSQLResult {
  rows: any[]
  /** True when the result set was cut off at MAX_RESULT_ROWS */
  truncated: boolean
}

/**
 * Read a validated SELECT on an already-connected client under the restricted
 * policy: READ ONLY transaction + statement timeout + cursor-bounded row cap.
 * Shared by the demo path (here) and the external-connection path
 * (lib/external-db.ts) so both get identical memory/time guarantees.
 */
export async function runBoundedReadOnly(
  client: PoolClient,
  sql: string,
  options?: { timeoutMs?: number; maxRows?: number }
): Promise<GeneratedSQLResult> {
  const timeoutMs = Math.min(Math.max(options?.timeoutMs ?? DEFAULT_TIMEOUT_MS, 1_000), 60_000)
  const maxRows = Math.min(Math.max(options?.maxRows ?? MAX_RESULT_ROWS, 1), MAX_RESULT_ROWS)

  let cursor: Cursor | null = null
  try {
    // READ ONLY blocks INSERT/UPDATE/DELETE/DDL and SELECT ... FOR UPDATE at
    // the database level regardless of the connected role's privileges.
    await client.query('BEGIN READ ONLY')
    // timeoutMs is clamped to a numeric range above — safe to interpolate
    await client.query(`SET LOCAL statement_timeout = ${Math.floor(timeoutMs)}`)

    cursor = client.query(new Cursor(sql))
    // Read one more than the cap so truncation can be reported without ever
    // materializing the full result set.
    const rows: any[] = await new Promise((resolve, reject) => {
      cursor!.read(maxRows + 1, (err: Error | undefined, result: any[]) =>
        err ? reject(err) : resolve(result)
      )
    })
    await cursor.close().catch(() => {})
    cursor = null
    await client.query('COMMIT')

    if (rows.length > maxRows) {
      return { rows: rows.slice(0, maxRows), truncated: true }
    }
    return { rows, truncated: false }
  } catch (error) {
    if (cursor) await cursor.close().catch(() => {})
    await client.query('ROLLBACK').catch(() => {})
    throw error
  }
}

/**
 * Execute validated, LLM-generated SQL against the restricted demo-data pool.
 * The SQL must already have passed validateGeneratedSQL().
 */
export async function executeGeneratedSQL(
  sql: string,
  options?: { timeoutMs?: number; maxRows?: number }
): Promise<GeneratedSQLResult> {
  const client = await queryPool.connect()
  try {
    return await runBoundedReadOnly(client, sql, options)
  } finally {
    client.release()
  }
}
