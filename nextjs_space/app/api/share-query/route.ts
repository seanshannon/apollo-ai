
/**
 * Query Sharing API
 *
 * Creates shareable deep links to query results using random, DB-backed
 * tokens. The previous scheme embedded an AES ciphertext of the query id in
 * the URL — not URL-safe, unrevocable, and dependent on the encryption key.
 * Tokens here are 256-bit random base64url values with server-side expiry
 * and revocation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { sanitizeSQLForLogging } from '@/lib/sql-validator'

export const dynamic = "force-dynamic"

const SHARE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export async function POST(request: NextRequest) {
  const session: any = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { queryHistoryId } = body

    if (!queryHistoryId) {
      return NextResponse.json({ error: 'Query history ID required' }, { status: 400 })
    }

    // Verify query belongs to user
    const query = await prisma.queryHistory.findUnique({
      where: { id: queryHistoryId },
      select: { id: true, userId: true }
    })

    if (!query) {
      return NextResponse.json({ error: 'Query not found' }, { status: 404 })
    }

    if (query.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const shareLink = await prisma.shareLink.create({
      data: {
        token: randomBytes(32).toString('base64url'),
        queryHistoryId,
        createdById: session.user.id,
        expiresAt: new Date(Date.now() + SHARE_LINK_TTL_MS),
      }
    })

    const ipAddress = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    await createAuditLog({
      userId: session.user.id,
      action: 'QUERY_SHARE',
      resource: `query:${queryHistoryId}`,
      details: { queryHistoryId, shareLinkId: shareLink.id },
      ipAddress,
      userAgent,
      success: true
    })

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    return NextResponse.json({
      success: true,
      shareUrl: `${baseUrl}/share/${shareLink.token}`,
      expiresAt: shareLink.expiresAt.toISOString(),
      expiresIn: '7 days'
    })

  } catch (error) {
    console.error('Share query error:', error)
    return NextResponse.json(
      { error: 'Failed to create share link' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    const shareLink = await prisma.shareLink.findUnique({
      where: { token },
      include: {
        queryHistory: {
          include: {
            user: {
              select: { firstName: true, lastName: true, email: true }
            }
          }
        }
      }
    })

    if (!shareLink || shareLink.revokedAt) {
      return NextResponse.json({ error: 'Share link not found or revoked' }, { status: 404 })
    }

    if (shareLink.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Share link expired' }, { status: 410 })
    }

    const query = shareLink.queryHistory

    // This endpoint is UNAUTHENTICATED (anyone with the link). Do not expose:
    //  - the raw generated SQL, whose WHERE literals echo back the exact
    //    values the sharer typed (emails, ids); strip literals first.
    //  - the sharer's raw email address (user enumeration / phishing); fall
    //    back to a generic label, never the email.
    const sharedBy = query.user.firstName && query.user.lastName
      ? `${query.user.firstName} ${query.user.lastName}`
      : query.user.firstName || 'A teammate'

    return NextResponse.json({
      success: true,
      query: {
        naturalQuery: query.naturalQuery,
        databaseName: query.databaseName,
        results: query.results,
        resultsSummary: query.resultsSummary,
        generatedSql: query.generatedSql ? sanitizeSQLForLogging(query.generatedSql) : query.generatedSql,
        executionTime: query.executionTime,
        createdAt: query.createdAt,
        sharedBy
      }
    })

  } catch (error) {
    console.error('Get shared query error:', error)
    return NextResponse.json(
      { error: 'Failed to load shared query' },
      { status: 500 }
    )
  }
}

/**
 * Revoke a share link (creator only). Accepts ?token= or ?queryHistoryId=
 * (the latter revokes all active links for that query).
 */
export async function DELETE(request: NextRequest) {
  const session: any = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const queryHistoryId = searchParams.get('queryHistoryId')

    if (!token && !queryHistoryId) {
      return NextResponse.json({ error: 'token or queryHistoryId required' }, { status: 400 })
    }

    const { count } = await prisma.shareLink.updateMany({
      where: {
        createdById: session.user.id,
        revokedAt: null,
        ...(token ? { token } : {}),
        ...(queryHistoryId ? { queryHistoryId } : {}),
      },
      data: { revokedAt: new Date() }
    })

    if (count === 0) {
      return NextResponse.json({ error: 'No matching active share link' }, { status: 404 })
    }

    return NextResponse.json({ success: true, revoked: count })
  } catch (error) {
    console.error('Revoke share link error:', error)
    return NextResponse.json(
      { error: 'Failed to revoke share link' },
      { status: 500 }
    )
  }
}
