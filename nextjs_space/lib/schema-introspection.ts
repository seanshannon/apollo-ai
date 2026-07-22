/**
 * Dynamic schema introspection for LLM prompt generation
 *
 * Replaces the hand-maintained schema strings in the query route. For each
 * demo database we introspect the live PostgreSQL catalog — columns, types,
 * enum values, foreign keys, and a few sample values — and render a schema
 * document for the SQL-generation prompt. Results are cached (10 min TTL via
 * getCachedSchema) so the catalog is not hit on every query.
 *
 * Introspection only ever targets tables on the validator's allowlist
 * (DATABASE_TABLE_ALLOWLISTS), so this module cannot be used to describe or
 * sample application tables.
 */

import { prisma } from './db'
import { getCachedSchema } from './db-optimization'
import { DATABASE_TABLE_ALLOWLISTS } from './sql-validator'
import { maskPII } from './pii-masking'

interface ColumnInfo {
  name: string
  dataType: string
  udtName: string
  nullable: boolean
  enumValues?: string[]
}

interface ForeignKeyInfo {
  column: string
  referencedTable: string
  referencedColumn: string
}

interface TableInfo {
  name: string
  columns: ColumnInfo[]
  foreignKeys: ForeignKeyInfo[]
  sampleValues: Record<string, string[]>
}

/**
 * Introspect one table's columns, enum values, and foreign keys from the
 * PostgreSQL catalog. All queries are parameterized.
 */
async function introspectTable(tableName: string): Promise<TableInfo> {
  const columns = await prisma.$queryRaw<
    { column_name: string; data_type: string; udt_name: string; is_nullable: string }[]
  >`
    SELECT column_name, data_type, udt_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${tableName}
    ORDER BY ordinal_position
  `

  const enumTypes = [...new Set(columns.filter(c => c.data_type === 'USER-DEFINED').map(c => c.udt_name))]
  const enumValues = new Map<string, string[]>()
  if (enumTypes.length > 0) {
    const rows = await prisma.$queryRaw<{ typname: string; enumlabel: string }[]>`
      SELECT t.typname, e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = ANY(${enumTypes})
      ORDER BY t.typname, e.enumsortorder
    `
    for (const row of rows) {
      const list = enumValues.get(row.typname) ?? []
      list.push(row.enumlabel)
      enumValues.set(row.typname, list)
    }
  }

  const fks = await prisma.$queryRaw<
    { column_name: string; foreign_table: string; foreign_column: string }[]
  >`
    SELECT
      kcu.column_name,
      ccu.table_name AS foreign_table,
      ccu.column_name AS foreign_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = ${tableName}
  `

  // A few sample values per text column give the model concrete formats
  // (state codes vs names, status casing, ...). Values are PII-masked before
  // they reach the prompt. Table name comes from the static allowlist, never
  // from user input.
  const sampleValues: Record<string, string[]> = {}
  try {
    const sampleRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "${tableName}" LIMIT 3`
    )
    for (const col of columns) {
      if (!['text', 'character varying', 'USER-DEFINED'].includes(col.data_type)) continue
      // Opaque ID values are noise in the prompt
      if (col.column_name === 'id' || col.column_name.endsWith('Id')) continue
      const values = [
        ...new Set(
          sampleRows
            .map(r => r[col.column_name])
            .filter((v): v is string => typeof v === 'string' && v.length > 0)
            .map(v => maskPII(v.length > 40 ? `${v.slice(0, 40)}…` : v).masked)
        ),
      ].slice(0, 3)
      if (values.length > 0) sampleValues[col.column_name] = values
    }
  } catch {
    // Sampling is best-effort; the schema doc is still useful without it
  }

  return {
    name: tableName,
    columns: columns.map(c => ({
      name: c.column_name,
      dataType: c.data_type,
      udtName: c.udt_name,
      nullable: c.is_nullable === 'YES',
      enumValues: c.data_type === 'USER-DEFINED' ? enumValues.get(c.udt_name) : undefined,
    })),
    foreignKeys: fks.map(f => ({
      column: f.column_name,
      referencedTable: f.foreign_table,
      referencedColumn: f.foreign_column,
    })),
    sampleValues,
  }
}

function friendlyType(col: ColumnInfo): string {
  if (col.enumValues) return `enum(${col.enumValues.join(' | ')})`
  switch (col.dataType) {
    case 'character varying':
    case 'text':
      return 'text'
    case 'timestamp without time zone':
    case 'timestamp with time zone':
      return 'timestamp'
    case 'double precision':
      return 'number'
    default:
      return col.dataType
  }
}

/**
 * Render one table as prompt text, mirroring the conventions the SQL rules
 * expect (double-quoted camelCase columns, uppercase enum warnings, JOIN
 * hints from foreign keys).
 */
function renderTable(table: TableInfo): string {
  const q = (name: string) => `"${name}"`
  const lines: string[] = []

  lines.push(`📊 ${table.name}`)
  lines.push(`Columns: ${table.columns.map(c => `${q(c.name)} (${friendlyType(c)})`).join(', ')}`)

  const enumColumns = table.columns.filter(c => c.enumValues && c.enumValues.length > 0)
  for (const col of enumColumns) {
    lines.push(
      `  ⚠️ ${q(col.name)} is an enum — values MUST be written EXACTLY as: ${col.enumValues!
        .map(v => `'${v}'`)
        .join(', ')} (case-sensitive)`
    )
  }

  for (const [col, values] of Object.entries(table.sampleValues)) {
    lines.push(`  Sample ${q(col)} values: ${values.map(v => `"${v}"`).join(', ')}`)
  }

  for (const fk of table.foreignKeys) {
    lines.push(
      `  🔗 ${q(fk.column)} → ${fk.referencedTable}.${q(fk.referencedColumn)} ` +
        `(JOIN ${fk.referencedTable} ON ${table.name}.${q(fk.column)} = ${fk.referencedTable}.${q(fk.referencedColumn)})`
    )
  }

  return lines.join('\n')
}

/**
 * Build the full schema document for a database from live introspection.
 * Throws if the database is unknown or introspection fails — callers decide
 * whether to fall back to static text.
 */
export async function introspectSchemaDoc(databaseId: string): Promise<string> {
  const tables = DATABASE_TABLE_ALLOWLISTS[databaseId]
  if (!tables) {
    throw new Error(`Unknown database: ${databaseId}`)
  }

  const infos = await Promise.all(tables.map(t => introspectTable(t)))

  const joinHints = infos
    .flatMap(t => t.foreignKeys.map(fk => `- ${t.name}.${fk.column} joins to ${fk.referencedTable}.${fk.referencedColumn}`))
    .join('\n')

  return [
    `Tables (always double-quote camelCase column names, e.g. "firstName"):`,
    '',
    infos.map(renderTable).join('\n\n'),
    '',
    joinHints ? `RELATIONSHIPS:\n${joinHints}` : '',
    '',
    `CRITICAL: When a query surfaces a foreign-key ID column, JOIN the referenced table and return its human-readable name column instead of the raw ID.`,
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Cached schema doc for a database (10-minute TTL). Falls back to the
 * provided static text if introspection fails (e.g. the database is
 * unreachable at prompt-build time).
 */
export async function getSchemaDocWithFallback(
  databaseId: string,
  staticFallback: string
): Promise<string> {
  try {
    return await getCachedSchema(`prompt-doc:${databaseId}`, () => introspectSchemaDoc(databaseId))
  } catch (error) {
    console.warn(
      `[schema-introspection] Falling back to static schema for "${databaseId}":`,
      error instanceof Error ? error.message : error
    )
    return staticFallback
  }
}
