
/**
 * Query Sharing API
 * Creates shareable deep links to query results
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { encrypt } from '@/lib/encryption'

export const dynamic = "force-dynamic"

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
      include: { user: true }
    })

    if (!query) {
      return NextResponse.json({ error: 'Query not found' }, { status: 404 })
    }

    if (query.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get request metadata
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Create encrypted share token
    const shareData = {
      queryId: queryHistoryId,
      userId: session.user.id,
      createdAt: new Date().toISOString()
    }
    
    const shareToken = encrypt(JSON.stringify(shareData))

    // Create audit log
    await createAuditLog({
      userId: session.user.id,
      action: 'QUERY_SHARE',
      resource: `query:${queryHistoryId}`,
      details: { queryHistoryId },
      ipAddress,
      userAgent,
      success: true
    })

    // Generate shareable URL
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const shareUrl = `${baseUrl}/share/${shareToken}`

    return NextResponse.json({
      success: true,
      shareUrl,
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

    // Decrypt and verify token
    const shareData = JSON.parse(decrypt(token))
    
    // Check if token is expired (7 days)
    const createdAt = new Date(shareData.createdAt)
    const now = new Date()
    const daysDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
    
    if (daysDiff > 7) {
      return NextResponse.json({ error: 'Share link expired' }, { status: 410 })
    }

    // Fetch query
    const query = await prisma.queryHistory.findUnique({
      where: { id: shareData.queryId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    if (!query) {
      return NextResponse.json({ error: 'Query not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      query: {
        naturalQuery: query.naturalQuery,
        databaseName: query.databaseName,
        results: query.results,
        resultsSummary: query.resultsSummary,
        generatedSql: query.generatedSql,
        executionTime: query.executionTime,
        createdAt: query.createdAt,
        sharedBy: query.user.firstName && query.user.lastName 
          ? `${query.user.firstName} ${query.user.lastName}`
          : query.user.email
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

function decrypt(encrypted: string): string {
  // Use the encryption module's decrypt function
  const { decrypt: decryptFn } = require('@/lib/encryption')
  return decryptFn(encrypted)
}
