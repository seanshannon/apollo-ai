
/**
 * Audit logging for compliance and security
 * Tracks all data access and queries
 */

import { prisma } from './db'

export type AuditAction = 
  | 'LOGIN'
  | 'LOGOUT'
  | 'QUERY_EXECUTE'
  | 'QUERY_VIEW'
  | 'QUERY_EXPLAIN'
  | 'QUERY_SHARE'
  | 'DATABASE_CONNECT'
  | 'DB_CONNECTION_TEST'
  | 'DB_CONNECTION_ADD'
  | 'DB_CONNECTION_DELETE'
  | 'SCHEMA_DISCOVERY'
  | 'EXPORT_DATA'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE'
  | 'PERMISSION_CHANGE'

export interface AuditLogEntry {
  organizationId?: string  // Optional for now, will be required after full migration
  userId: string
  action: AuditAction
  resource?: string
  details?: Record<string, any> | string
  ipAddress?: string
  userAgent?: string
  success: boolean
  errorMessage?: string
}

/**
 * Creates an audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    // Get organizationId if not provided (for backward compatibility)
    let orgId = entry.organizationId
    if (!orgId) {
      // Try to find user's default organization
      const user = await prisma.user.findUnique({
        where: { id: entry.userId },
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
      orgId = user?.ownedOrgs[0]?.id || user?.memberships[0]?.organizationId
      
      // If still no org, skip audit log (user not properly set up yet)
      if (!orgId) {
        console.warn('Skipping audit log - no organization found for user:', entry.userId)
        return
      }
    }

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId: entry.userId,
        action: entry.action,
        resource: entry.resource,
        details: typeof entry.details === 'string' ? entry.details : (entry.details ? JSON.stringify(entry.details) : null),
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        success: entry.success,
        errorMessage: entry.errorMessage,
        timestamp: new Date()
      }
    })
  } catch (error) {
    console.error('Failed to create audit log:', error)
    // Don't throw - audit logging should never break the main flow
  }
}

/**
 * Gets audit logs for a user
 */
export async function getUserAuditLogs(
  userId: string,
  limit: number = 100,
  offset: number = 0
) {
  return await prisma.auditLog.findMany({
    where: { userId },
    orderBy: { timestamp: 'desc' },
    take: limit,
    skip: offset
  })
}

/**
 * Gets audit logs for a specific action
 */
export async function getAuditLogsByAction(
  action: AuditAction,
  limit: number = 100,
  offset: number = 0
) {
  return await prisma.auditLog.findMany({
    where: { action },
    orderBy: { timestamp: 'desc' },
    take: limit,
    skip: offset
  })
}

/**
 * Gets failed access attempts (security monitoring)
 */
export async function getFailedAttempts(
  userId?: string,
  since?: Date,
  limit: number = 100
) {
  return await prisma.auditLog.findMany({
    where: {
      success: false,
      userId,
      timestamp: since ? { gte: since } : undefined
    },
    orderBy: { timestamp: 'desc' },
    take: limit
  })
}
