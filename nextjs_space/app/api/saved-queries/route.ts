
/**
 * Saved Queries API
 * Pin useful natural-language queries for one-click re-use.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const MAX_NAME_LENGTH = 120
const MAX_QUERY_LENGTH = 1000

/** Resolve the caller's organization (first owned or member org) */
async function getOrganizationId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ownedOrgs: { select: { id: true }, take: 1 },
      memberships: { select: { organizationId: true }, take: 1 },
    },
  })
  return user?.ownedOrgs[0]?.id || user?.memberships[0]?.organizationId || null
}

export async function GET(request: NextRequest) {
  const session: any = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const organizationId = await getOrganizationId(session.user.id)
    if (!organizationId) {
      return NextResponse.json({ savedQueries: [] })
    }

    const { searchParams } = new URL(request.url)
    const databaseId = searchParams.get('databaseId')

    const savedQueries = await prisma.savedQuery.findMany({
      where: {
        organizationId,
        ...(databaseId ? { databaseId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        name: true,
        naturalQuery: true,
        databaseId: true,
        generatedSql: true,
        createdAt: true,
        userId: true,
      },
    })

    return NextResponse.json({ savedQueries })
  } catch (error) {
    console.error('List saved queries error:', error)
    return NextResponse.json({ error: 'Failed to load saved queries' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session: any = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const organizationId = await getOrganizationId(session.user.id)
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization found for user' }, { status: 400 })
    }

    const body = await request.json()
    const { name, naturalQuery, databaseId, generatedSql } = body

    if (!naturalQuery || !databaseId) {
      return NextResponse.json({ error: 'naturalQuery and databaseId are required' }, { status: 400 })
    }
    if (naturalQuery.length > MAX_QUERY_LENGTH) {
      return NextResponse.json({ error: 'Query too long' }, { status: 400 })
    }

    const trimmedName = (typeof name === 'string' && name.trim()) || naturalQuery.trim()

    const savedQuery = await prisma.savedQuery.create({
      data: {
        organizationId,
        userId: session.user.id,
        name: trimmedName.slice(0, MAX_NAME_LENGTH),
        naturalQuery: naturalQuery.trim(),
        databaseId: String(databaseId),
        generatedSql: typeof generatedSql === 'string' ? generatedSql : null,
      },
    })

    return NextResponse.json({ success: true, savedQuery }, { status: 201 })
  } catch (error) {
    console.error('Save query error:', error)
    return NextResponse.json({ error: 'Failed to save query' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session: any = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const organizationId = await getOrganizationId(session.user.id)
    const existing = await prisma.savedQuery.findUnique({ where: { id } })

    if (!existing || existing.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Saved query not found' }, { status: 404 })
    }

    await prisma.savedQuery.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete saved query error:', error)
    return NextResponse.json({ error: 'Failed to delete saved query' }, { status: 500 })
  }
}
