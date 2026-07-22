/**
 * External database connections — real implementation (PostgreSQL v1)
 *
 * Previously testConnection() validated nothing and no external execution
 * path existed. This module provides the genuine article for PostgreSQL:
 *
 *  - testExternalConnection(): actually connects and runs SELECT 1
 *  - introspectExternalSchema(): reads tables/columns/enums/FKs from the
 *    external catalog, renders the LLM prompt document, and caches the result
 *    in ZKDatabaseConnection.schemaCache
 *  - executeExternalSQL(): runs validated SQL in a READ ONLY transaction with
 *    a statement timeout and row cap, via a per-connection pool
 *
 * Access control: every entry point that touches a stored connection takes
 * the caller's organizationId and verifies the connection belongs to it —
 * connection IDs are not capability tokens.
 *
 * Other engines (MySQL, SQL Server, ...) intentionally throw a clear
 * "not yet supported" error instead of pretending to work.
 */

import { Pool } from 'pg'
import { prisma } from './db'
import { decrypt } from './encryption'

const SUPPORTED_TYPES = new Set(['postgres', 'postgresql'])
const CONNECT_TIMEOUT_MS = 5_000
const STATEMENT_TIMEOUT_MS = 15_000
const MAX_RESULT_ROWS = 1_000
const SCHEMA_CACHE_MAX_AGE_MS = 60 * 60 * 1000 // 1 hour

export interface ExternalConnectionConfig {
  type: string
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl?: boolean
}

export interface ExternalSchema {
  tables: {
    name: string
    columns: { name: string; type: string; nullable: boolean; enumValues?: string[] }[]
    foreignKeys: { column: string; referencedTable: string; referencedColumn: string }[]
  }[]
  /** Rendered prompt document for the LLM */
  promptDoc: string
  /** Table names for the SQL validator's allowlist */
  allowlist: string[]
  lastSynced: string
}

export function isSupportedExternalType(type: string): boolean {
  return SUPPORTED_TYPES.has(type.toLowerCase())
}

function assertSupported(type: string): void {
  if (!isSupportedExternalType(type)) {
    throw new Error(
      `Database type "${type}" is not yet supported for live connections — PostgreSQL only for now`
    )
  }
}

// ---------------------------------------------------------------------------
// Connection pools (one per stored connection, lazily created)
// ---------------------------------------------------------------------------

const pools = new Map<string, Pool>()

function poolFor(connectionId: string, config: ExternalConnectionConfig): Pool {
  let pool = pools.get(connectionId)
  if (!pool) {
    pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    })
    pool.on('error', (err) => {
      console.error(`[external-db] Pool error for connection ${connectionId}:`, err.message)
    })
    pools.set(connectionId, pool)
  }
  return pool
}

/** Drop the cached pool (after credential changes or deletion) */
export async function evictPool(connectionId: string): Promise<void> {
  const pool = pools.get(connectionId)
  if (pool) {
    pools.delete(connectionId)
    await pool.end().catch(() => {})
  }
}

// ---------------------------------------------------------------------------
// Authorization + credential access
// ---------------------------------------------------------------------------

/**
 * Load a stored connection's decrypted config, verifying it belongs to the
 * caller's organization. Returns null if not found or not authorized.
 */
export async function getAuthorizedConnection(
  connectionId: string,
  organizationId: string
): Promise<{ id: string; name: string; type: string; config: ExternalConnectionConfig } | null> {
  const conn = await prisma.zKDatabaseConnection.findFirst({
    where: { id: connectionId, organizationId, isActive: true },
  })
  if (!conn) return null

  const credentials = JSON.parse(conn.encryptedCredentials)
  return {
    id: conn.id,
    name: conn.name,
    type: conn.type,
    config: {
      type: conn.type,
      host: credentials.host,
      port: credentials.port,
      database: credentials.database,
      username: credentials.username,
      password: decrypt(credentials.password),
      ssl: credentials.ssl || false,
    },
  }
}

// ---------------------------------------------------------------------------
// Connection testing
// ---------------------------------------------------------------------------

/**
 * Really test a connection: connect and run SELECT 1. Returns the server
 * version on success, throws with a useful message on failure.
 */
export async function testExternalConnection(
  config: ExternalConnectionConfig
): Promise<{ ok: true; serverVersion: string }> {
  assertSupported(config.type)

  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    max: 1,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
  })

  try {
    const result = await pool.query('SELECT version() AS v')
    return { ok: true, serverVersion: String(result.rows[0]?.v ?? 'unknown') }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Connection test failed: ${message}`)
  } finally {
    await pool.end().catch(() => {})
  }
}

// ---------------------------------------------------------------------------
// Schema introspection
// ---------------------------------------------------------------------------

async function introspectLive(
  connectionId: string,
  config: ExternalConnectionConfig
): Promise<ExternalSchema> {
  const pool = poolFor(connectionId, config)

  const columns = await pool.query<{
    table_name: string
    column_name: string
    data_type: string
    udt_name: string
    is_nullable: string
  }>(`
    SELECT c.table_name, c.column_name, c.data_type, c.udt_name, c.is_nullable
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    ORDER BY c.table_name, c.ordinal_position
  `)

  const enums = await pool.query<{ typname: string; enumlabel: string }>(`
    SELECT t.typname, e.enumlabel
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    ORDER BY t.typname, e.enumsortorder
  `)
  const enumValues = new Map<string, string[]>()
  for (const row of enums.rows) {
    const list = enumValues.get(row.typname) ?? []
    list.push(row.enumlabel)
    enumValues.set(row.typname, list)
  }

  const fks = await pool.query<{
    table_name: string
    column_name: string
    foreign_table: string
    foreign_column: string
  }>(`
    SELECT tc.table_name, kcu.column_name,
           ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `)

  const tableMap = new Map<string, ExternalSchema['tables'][number]>()
  for (const row of columns.rows) {
    let table = tableMap.get(row.table_name)
    if (!table) {
      table = { name: row.table_name, columns: [], foreignKeys: [] }
      tableMap.set(row.table_name, table)
    }
    table.columns.push({
      name: row.column_name,
      type: row.data_type === 'USER-DEFINED' ? `enum` : row.data_type,
      nullable: row.is_nullable === 'YES',
      enumValues: row.data_type === 'USER-DEFINED' ? enumValues.get(row.udt_name) : undefined,
    })
  }
  for (const row of fks.rows) {
    tableMap.get(row.table_name)?.foreignKeys.push({
      column: row.column_name,
      referencedTable: row.foreign_table,
      referencedColumn: row.foreign_column,
    })
  }

  const tables = [...tableMap.values()]
  const promptDoc = renderPromptDoc(tables)

  return {
    tables,
    promptDoc,
    allowlist: tables.map(t => t.name),
    lastSynced: new Date().toISOString(),
  }
}

function renderPromptDoc(tables: ExternalSchema['tables']): string {
  const q = (name: string) => `"${name}"`
  const sections = tables.map(table => {
    const lines = [
      `📊 ${table.name}`,
      `Columns: ${table.columns
        .map(c => `${q(c.name)} (${c.enumValues ? `enum(${c.enumValues.join(' | ')})` : c.type})`)
        .join(', ')}`,
    ]
    for (const col of table.columns) {
      if (col.enumValues?.length) {
        lines.push(
          `  ⚠️ ${q(col.name)} values MUST be written EXACTLY as: ${col.enumValues.map(v => `'${v}'`).join(', ')}`
        )
      }
    }
    for (const fk of table.foreignKeys) {
      lines.push(
        `  🔗 ${q(fk.column)} → ${fk.referencedTable}.${q(fk.referencedColumn)} ` +
          `(JOIN ${fk.referencedTable} ON ${table.name}.${q(fk.column)} = ${fk.referencedTable}.${q(fk.referencedColumn)})`
      )
    }
    return lines.join('\n')
  })

  return [
    `Tables (always double-quote camelCase column names):`,
    '',
    sections.join('\n\n'),
    '',
    `CRITICAL: When a query surfaces a foreign-key ID column, JOIN the referenced table and return a human-readable column instead of the raw ID.`,
  ].join('\n')
}

/**
 * Get the schema for a stored connection, from ZKDatabaseConnection.schemaCache
 * when fresh, introspecting live (and updating the cache) otherwise.
 */
export async function getExternalSchema(
  connectionId: string,
  organizationId: string,
  options?: { forceRefresh?: boolean }
): Promise<ExternalSchema> {
  const conn = await getAuthorizedConnection(connectionId, organizationId)
  if (!conn) {
    throw new Error('Connection not found or not accessible from your organization')
  }
  assertSupported(conn.type)

  if (!options?.forceRefresh) {
    const stored = await prisma.zKDatabaseConnection.findUnique({
      where: { id: connectionId },
      select: { schemaCache: true, lastSchemaSync: true },
    })
    if (
      stored?.schemaCache &&
      stored.lastSchemaSync &&
      Date.now() - stored.lastSchemaSync.getTime() < SCHEMA_CACHE_MAX_AGE_MS
    ) {
      try {
        const cached = JSON.parse(stored.schemaCache) as ExternalSchema
        if (cached.promptDoc && Array.isArray(cached.allowlist)) return cached
      } catch {
        // fall through to live introspection
      }
    }
  }

  const schema = await introspectLive(connectionId, conn.config)
  await prisma.zKDatabaseConnection.update({
    where: { id: connectionId },
    data: { schemaCache: JSON.stringify(schema), lastSchemaSync: new Date() },
  })
  return schema
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export interface ExternalSQLResult {
  rows: any[]
  truncated: boolean
}

/**
 * Execute validated SQL on an external connection under the same guarantees
 * as the internal path: READ ONLY transaction, statement timeout, row cap.
 * The SQL must already have passed validateSQLAgainstAllowlist().
 */
export async function executeExternalSQL(
  connectionId: string,
  organizationId: string,
  sql: string
): Promise<ExternalSQLResult> {
  const conn = await getAuthorizedConnection(connectionId, organizationId)
  if (!conn) {
    throw new Error('Connection not found or not accessible from your organization')
  }
  assertSupported(conn.type)

  const pool = poolFor(connectionId, conn.config)
  const client = await pool.connect()
  try {
    await client.query('BEGIN READ ONLY')
    await client.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`)
    const result = await client.query(sql)
    await client.query('COMMIT')

    const rows = result.rows ?? []
    if (rows.length > MAX_RESULT_ROWS) {
      return { rows: rows.slice(0, MAX_RESULT_ROWS), truncated: true }
    }
    return { rows, truncated: false }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
