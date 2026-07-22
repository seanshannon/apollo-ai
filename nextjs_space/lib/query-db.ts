/**
 * Restricted execution path for LLM-generated SQL
 *
 * Generated SQL never runs on the application's main connection. It runs on a
 * separate Prisma client whose connection string (QUERY_DATABASE_URL) should
 * point at the `apollo_query_readonly` role created by
 * prisma/sql/setup-readonly-role.sql — a role with SELECT granted only on the
 * demo dataset tables, and nothing else.
 *
 * Independent of the role, every execution here is wrapped in a transaction
 * that is forced READ ONLY with a statement timeout, and results are capped
 * at MAX_RESULT_ROWS. So even if QUERY_DATABASE_URL is misconfigured to a
 * privileged role, generated SQL cannot write, cannot run forever, and cannot
 * exfiltrate unbounded data in one call.
 */

import { PrismaClient } from '@prisma/client'

const DEFAULT_TIMEOUT_MS = 15_000
const MAX_RESULT_ROWS = 1_000

const globalForQueryPrisma = globalThis as unknown as {
  queryPrisma: PrismaClient | undefined
}

function createQueryClient(): PrismaClient {
  const url = process.env.QUERY_DATABASE_URL || process.env.DATABASE_URL
  if (!process.env.QUERY_DATABASE_URL) {
    console.warn(
      '[query-db] QUERY_DATABASE_URL is not set — generated SQL will run on the main ' +
        'database role. Create the restricted role (prisma/sql/setup-readonly-role.sql) ' +
        'and set QUERY_DATABASE_URL to use it. READ ONLY transactions and timeouts ' +
        'still apply, but table-level isolation depends on the restricted role.'
    )
  }
  return new PrismaClient({
    log: ['error'],
    datasources: { db: { url } },
  })
}

export const queryPrisma = globalForQueryPrisma.queryPrisma ?? createQueryClient()

if (process.env.NODE_ENV !== 'production') globalForQueryPrisma.queryPrisma = queryPrisma

export interface GeneratedSQLResult {
  rows: any[]
  /** True when the result set was cut off at MAX_RESULT_ROWS */
  truncated: boolean
}

/**
 * Execute validated, LLM-generated SQL under the restricted policy:
 * READ ONLY transaction + statement timeout + row cap.
 *
 * The SQL must already have passed validateGeneratedSQL(); this function adds
 * the execution-side guarantees.
 */
export async function executeGeneratedSQL(
  sql: string,
  options?: { timeoutMs?: number; maxRows?: number }
): Promise<GeneratedSQLResult> {
  const timeoutMs = Math.min(Math.max(options?.timeoutMs ?? DEFAULT_TIMEOUT_MS, 1_000), 60_000)
  const maxRows = Math.min(Math.max(options?.maxRows ?? MAX_RESULT_ROWS, 1), MAX_RESULT_ROWS)

  const rows = await queryPrisma.$transaction(
    async (tx) => {
      // Must run before any query in the transaction. Blocks INSERT/UPDATE/
      // DELETE/DDL and SELECT ... FOR UPDATE at the database level, regardless
      // of what privileges the connected role has.
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
      // timeoutMs is clamped to a numeric range above — safe to interpolate
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${Math.floor(timeoutMs)}`)
      return tx.$queryRawUnsafe<any[]>(sql)
    },
    { timeout: timeoutMs + 5_000 }
  )

  const resultRows = Array.isArray(rows) ? rows : []
  if (resultRows.length > maxRows) {
    return { rows: resultRows.slice(0, maxRows), truncated: true }
  }
  return { rows: resultRows, truncated: false }
}
