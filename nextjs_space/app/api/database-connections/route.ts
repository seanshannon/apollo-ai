
/**
 * Database Connections API
 * Manages external database connections
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { prisma } from '@/lib/db'
import { 
  addConnection, 
  getOrganizationConnections, 
  removeConnection,
  testConnection 
} from '@/lib/database-connections'

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session: any = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get organizationId from query params
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 })
    }

    // Verify user has access to this organization
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: session.user.id
        }
      }
    })

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to this organization' }, { status: 403 })
    }

    const connections = await getOrganizationConnections(organizationId)

    return NextResponse.json({
      success: true,
      connections
    })

  } catch (error) {
    console.error('Get connections error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const session: any = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { action, organizationId, ...config } = body

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 })
    }

    // Verify user has access to this organization
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: session.user.id
        }
      }
    })

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to this organization' }, { status: 403 })
    }

    // Get request metadata
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    if (action === 'test') {
      // Test connection
      const isValid = await testConnection(config)
      
      await createAuditLog({
        organizationId,
        userId: session.user.id,
        action: 'DB_CONNECTION_TEST',
        resource: `database:${config.name}`,
        details: JSON.stringify(config),
        ipAddress,
        userAgent,
        success: isValid
      })

      return NextResponse.json({
        success: true,
        valid: isValid
      })
    }

    // Add new connection
    const connection = await addConnection(organizationId, session.user.id, config)

    await createAuditLog({
      organizationId,
      userId: session.user.id,
      action: 'DB_CONNECTION_ADD',
      resource: `database:${connection.id}`,
      details: JSON.stringify({ name: config.name, type: config.type }),
      ipAddress,
      userAgent,
      success: true
    })

    return NextResponse.json({
      success: true,
      connection
    })

  } catch (error) {
    console.error('Add connection error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add connection' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const session: any = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('id')

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID required' }, { status: 400 })
    }

    // Get the connection to find organizationId
    const connection = await prisma.zKDatabaseConnection.findUnique({
      where: { id: connectionId },
      select: { organizationId: true }
    })

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    await removeConnection(connectionId)

    // Get request metadata
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    await createAuditLog({
      organizationId: connection.organizationId,
      userId: session.user.id,
      action: 'DB_CONNECTION_DELETE',
      resource: `database:${connectionId}`,
      details: JSON.stringify({ connectionId }),
      ipAddress,
      userAgent,
      success: true
    })

    return NextResponse.json({
      success: true
    })

  } catch (error) {
    console.error('Delete connection error:', error)
    return NextResponse.json(
      { error: 'Failed to delete connection' },
      { status: 500 }
    )
  }
}
