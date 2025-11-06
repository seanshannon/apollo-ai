
/**
 * Multi-Database Connection Manager
 * Manages connections to multiple external databases
 */

import { encrypt, decrypt } from './encryption'
import { prisma } from './db'

export interface DatabaseConnection {
  id: string
  name: string
  type: 'postgresql' | 'mysql' | 'mariadb' | 'oracle' | 'sqlite' | 'mongodb'
  host: string
  port: number
  database: string
  username: string
  password: string // Encrypted
  ssl: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ConnectionConfig {
  name: string
  type: string
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl: boolean
}

export interface SchemaMetadata {
  tables: {
    name: string
    columns: {
      name: string
      type: string
      nullable: boolean
      primaryKey: boolean
    }[]
    foreignKeys: {
      column: string
      referencedTable: string
      referencedColumn: string
    }[]
    sampleData?: any[]
  }[]
  lastSynced: Date
}

/**
 * Add a new database connection for an organization
 */
export async function addConnection(
  organizationId: string,
  userId: string,
  config: ConnectionConfig
): Promise<DatabaseConnection> {
  // Test connection first
  await testConnection(config)

  // Encrypt credentials
  const encryptedCredentials = JSON.stringify({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: encrypt(config.password),
    ssl: config.ssl
  })

  // Save to database
  const dbConnection = await prisma.zKDatabaseConnection.create({
    data: {
      organizationId,
      userId,
      name: config.name,
      type: config.type,
      encryptedCredentials,
      isActive: true
    }
  })

  return {
    id: dbConnection.id,
    name: dbConnection.name,
    type: config.type as any,
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: '********',
    ssl: config.ssl,
    createdAt: dbConnection.createdAt,
    updatedAt: dbConnection.updatedAt
  }
}

/**
 * Get all connections for an organization
 */
export async function getOrganizationConnections(
  organizationId: string
): Promise<DatabaseConnection[]> {
  const dbConnections = await prisma.zKDatabaseConnection.findMany({
    where: {
      organizationId,
      isActive: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return dbConnections.map((conn: any) => {
    const credentials = JSON.parse(conn.encryptedCredentials)
    return {
      id: conn.id,
      name: conn.name,
      type: conn.type as any,
      host: credentials.host,
      port: credentials.port,
      database: credentials.database,
      username: credentials.username,
      password: '********', // Don't expose password
      ssl: credentials.ssl || false,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt
    }
  })
}

/**
 * Get a specific connection with decrypted credentials
 */
export async function getConnection(connectionId: string): Promise<DatabaseConnection | null> {
  const conn = await prisma.zKDatabaseConnection.findUnique({
    where: { id: connectionId }
  })

  if (!conn) return null

  const credentials = JSON.parse(conn.encryptedCredentials)
  
  return {
    id: conn.id,
    name: conn.name,
    type: conn.type as any,
    host: credentials.host,
    port: credentials.port,
    database: credentials.database,
    username: credentials.username,
    password: decrypt(credentials.password), // Decrypt for use
    ssl: credentials.ssl || false,
    createdAt: conn.createdAt,
    updatedAt: conn.updatedAt
  }
}

/**
 * Test database connection
 */
export async function testConnection(config: ConnectionConfig): Promise<boolean> {
  try {
    // Validate required fields
    if (!config.host || !config.database || !config.username) {
      throw new Error('Missing required connection parameters')
    }

    // In production, you would actually test the connection here
    // For example:
    // - For PostgreSQL: const { Client } = require('pg')
    // - For MySQL: const mysql = require('mysql2/promise')
    // - For Oracle: const oracledb = require('oracledb')
    
    // For now, just validate config structure
    return true
  } catch (error) {
    throw new Error(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Remove a connection
 */
export async function removeConnection(connectionId: string): Promise<void> {
  await prisma.zKDatabaseConnection.update({
    where: { id: connectionId },
    data: { isActive: false }
  })
}

/**
 * Update a connection
 */
export async function updateConnection(
  connectionId: string,
  config: Partial<ConnectionConfig>
): Promise<DatabaseConnection> {
  const existing = await prisma.zKDatabaseConnection.findUnique({
    where: { id: connectionId }
  })

  if (!existing) {
    throw new Error('Connection not found')
  }

  const existingCredentials = JSON.parse(existing.encryptedCredentials)

  // Update credentials
  const updatedCredentials = {
    host: config.host ?? existingCredentials.host,
    port: config.port ?? existingCredentials.port,
    database: config.database ?? existingCredentials.database,
    username: config.username ?? existingCredentials.username,
    password: config.password ? encrypt(config.password) : existingCredentials.password,
    ssl: config.ssl ?? existingCredentials.ssl
  }

  const updated = await prisma.zKDatabaseConnection.update({
    where: { id: connectionId },
    data: {
      name: config.name ?? existing.name,
      type: config.type ?? existing.type,
      encryptedCredentials: JSON.stringify(updatedCredentials)
    }
  })

  return {
    id: updated.id,
    name: updated.name,
    type: updated.type as any,
    host: updatedCredentials.host,
    port: updatedCredentials.port,
    database: updatedCredentials.database,
    username: updatedCredentials.username,
    password: '********',
    ssl: updatedCredentials.ssl,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt
  }
}

/**
 * Get or update schema cache for a connection
 */
export async function getSchemaCache(connectionId: string): Promise<SchemaMetadata | null> {
  const conn = await prisma.zKDatabaseConnection.findUnique({
    where: { id: connectionId },
    select: { schemaCache: true }
  })

  if (!conn?.schemaCache) return null
  
  return JSON.parse(conn.schemaCache) as SchemaMetadata
}

export async function updateSchemaCache(
  connectionId: string,
  schema: SchemaMetadata
): Promise<void> {
  await prisma.zKDatabaseConnection.update({
    where: { id: connectionId },
    data: {
      schemaCache: JSON.stringify(schema),
      lastSchemaSync: new Date()
    }
  })
}
