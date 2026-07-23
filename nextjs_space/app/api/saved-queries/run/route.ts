
/**
 * Instant re-run of a saved query
 *
 * Executes the saved query's stored SQL directly through the validated,
 * restricted execution path — no LLM round-trip, so results are immediate
 * and cost nothing. Works for demo databases and external connections.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { apiRateLimiter } from '@/lib/rate-limit'
import { maskQueryResults } from '@/lib/pii-masking'
import { executeQuery, ExternalQueryTarget } from '@/lib/database-query-executor'
import { DATABASE_TABLE_ALLOWLISTS } from '@/lib/sql-validator'
import { getAuthorizedConnection, getExternalSchema } from '@/lib/external-db'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** BigInt values (e.g. COUNT()) cannot be JSON-serialized directly */
function convertBigIntToString(data: any): any {
  if (data === null || data === undefined) return data
  if (typeof data === 'bigint') return data.toString()
  if (Array.isArray(data)) return data.map(convertBigIntToString)
  if (typeof data === 'object') {
    const converted: any = {}
    for (const key in data) converted[key] = convertBigIntToString(data[key])
    return converted
  }
  return data
}

export async function POST(request: NextRequest) {
  const session: any = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rateLimit = await apiRateLimiter(request, session.user.id)
  if (rateLimit.blocked) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const { id } = await request.json()
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Saved query id required' }, { status: 400 })
    }

    // Resolve the caller's organization and verify the saved query belongs to it
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        ownedOrgs: { select: { id: true }, take: 1 },
        memberships: { select: { organizationId: true }, take: 1 },
      },
    })
    const organizationId = user?.ownedOrgs[0]?.id || user?.memberships[0]?.organizationId
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization found for user' }, { status: 400 })
    }

    const savedQuery = await prisma.savedQuery.findUnique({ where: { id } })
    if (!savedQuery || savedQuery.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Saved query not found' }, { status: 404 })
    }

    if (!savedQuery.generatedSql) {
      return NextResponse.json(
        { error: 'This saved query has no stored SQL yet — run it once from the query box first' },
        { status: 400 }
      )
    }

    // Demo database or external connection target
    let externalTarget: ExternalQueryTarget | undefined
    if (!DATABASE_TABLE_ALLOWLISTS[savedQuery.databaseId]) {
      const conn = await getAuthorizedConnection(savedQuery.databaseId, organizationId)
      if (!conn) {
        return NextResponse.json(
          { error: 'The database connection for this saved query no longer exists' },
          { status: 404 }
        )
      }
      const schema = await getExternalSchema(savedQuery.databaseId, organizationId)
      externalTarget = {
        connectionId: savedQuery.databaseId,
        organizationId,
        allowlist: schema.allowlist,
        label: conn.name,
      }
    }

    const result = await executeQuery(
      savedQuery.databaseId,
      savedQuery.generatedSql,
      savedQuery.naturalQuery,
      externalTarget
    )

    const serializable = convertBigIntToString(result)
    const maskedData = maskQueryResults(serializable.data)

    await createAuditLog({
      organizationId,
      userId: session.user.id,
      action: 'QUERY_EXECUTE',
      resource: `saved-query:${savedQuery.id}`,
      details: { savedQueryId: savedQuery.id, databaseId: savedQuery.databaseId },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: true,
    })

    return NextResponse.json({
      success: true,
      naturalQuery: savedQuery.naturalQuery,
      sql: savedQuery.generatedSql,
      data: maskedData,
      rowCount: serializable.rowCount,
      executionTime: serializable.executionTime,
      confidence: serializable.confidence,
      suggestions: serializable.suggestions,
      visualization: serializable.visualization,
      truncated: serializable.truncated,
    })
  } catch (error) {
    console.error('Run saved query error:', error)
    const raw = error instanceof Error ? error.message : ''
    // Only surface our own safe, mapped messages; never the raw driver error
    // (which can leak internal DB host/port/username).
    const safe =
      raw.includes('Query rejected') ? 'This saved query can no longer be run safely against its database.' :
      raw.includes('not accessible') || raw.toLowerCase().includes('permission') ? 'You no longer have access to this data.' :
      raw.includes('timed out') || raw.includes('timeout') ? 'The query took too long to run.' :
      'Failed to run saved query. Please try again.'
    return NextResponse.json({ error: safe }, { status: 500 })
  }
}
