
/**
 * Schema Discovery API
 * Dynamically discovers and returns database schema information
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { getCachedSchema } from '@/lib/db-optimization'

export const dynamic = "force-dynamic"

interface TableInfo {
  name: string
  displayName: string
  rowCount: number
  columns: ColumnInfo[]
  relationships: RelationshipInfo[]
  description?: string
}

interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  isPrimaryKey: boolean
  isForeignKey: boolean
  description?: string
}

interface RelationshipInfo {
  fromTable: string
  toTable: string
  type: 'one-to-many' | 'many-to-one' | 'one-to-one' | 'many-to-many'
  description: string
}

export async function GET(request: NextRequest) {
  const session: any = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const databaseId = searchParams.get('databaseId')

    if (!databaseId) {
      return NextResponse.json({ error: 'Database ID required' }, { status: 400 })
    }

    // Get request metadata for audit logging
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Create audit log
    await createAuditLog({
      userId: session.user.id,
      action: 'SCHEMA_DISCOVERY',
      resource: `database:${databaseId}`,
      details: { databaseId },
      ipAddress,
      userAgent,
      success: true
    })

    // Discover schema with caching (10-minute TTL)
    const schemaInfo = await getCachedSchema(
      databaseId,
      () => discoverSchema(databaseId)
    )

    return NextResponse.json({
      success: true,
      database: databaseId,
      tables: schemaInfo,
      cached: true // Indicates schema might be from cache
    })

  } catch (error) {
    console.error('Schema discovery error:', error)
    return NextResponse.json(
      { error: 'Failed to discover schema' },
      { status: 500 }
    )
  }
}

async function discoverSchema(databaseId: string): Promise<TableInfo[]> {
  switch (databaseId) {
    case 'sales':
      return await discoverSalesSchema()
    case 'hr':
      return await discoverHRSchema()
    case 'inventory':
      return await discoverInventorySchema()
    case 'finance':
      return await discoverFinanceSchema()
    case 'customer_support':
      return await discoverSupportSchema()
    default:
      throw new Error(`Unknown database: ${databaseId}`)
  }
}

async function discoverSalesSchema(): Promise<TableInfo[]> {
  const [customerCount, productCount, orderCount] = await Promise.all([
    prisma.salesCustomer.count(),
    prisma.salesProduct.count(),
    prisma.salesOrder.count()
  ])

  return [
    {
      name: 'sales_customers',
      displayName: 'Customers',
      rowCount: customerCount,
      description: 'Customer information and contact details',
      columns: [
        { name: 'id', type: 'string', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'firstName', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'lastName', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'email', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Customer email address' },
        { name: 'phone', type: 'string', nullable: true, isPrimaryKey: false, isForeignKey: false },
        { name: 'totalSpent', type: 'number', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Total amount spent by customer' }
      ],
      relationships: [
        { fromTable: 'sales_customers', toTable: 'sales_orders', type: 'one-to-many', description: 'A customer can have many orders' }
      ]
    },
    {
      name: 'sales_products',
      displayName: 'Products',
      rowCount: productCount,
      description: 'Product catalog with pricing and inventory',
      columns: [
        { name: 'id', type: 'string', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'name', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'price', type: 'number', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'category', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'stockLevel', type: 'number', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Current inventory level' }
      ],
      relationships: [
        { fromTable: 'sales_products', toTable: 'sales_order_items', type: 'one-to-many', description: 'A product can be in many order items' }
      ]
    },
    {
      name: 'sales_orders',
      displayName: 'Orders',
      rowCount: orderCount,
      description: 'Customer orders and order details',
      columns: [
        { name: 'id', type: 'string', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'orderNumber', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'customerId', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: true },
        { name: 'totalAmount', type: 'number', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'status', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false }
      ],
      relationships: [
        { fromTable: 'sales_orders', toTable: 'sales_customers', type: 'many-to-one', description: 'An order belongs to one customer' },
        { fromTable: 'sales_orders', toTable: 'sales_order_items', type: 'one-to-many', description: 'An order can have many items' }
      ]
    }
  ]
}

async function discoverHRSchema(): Promise<TableInfo[]> {
  const [deptCount, empCount] = await Promise.all([
    prisma.hRDepartment.count(),
    prisma.hREmployee.count()
  ])

  return [
    {
      name: 'hr_departments',
      displayName: 'Departments',
      rowCount: deptCount,
      description: 'Organizational departments',
      columns: [
        { name: 'id', type: 'string', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'name', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'budget', type: 'number', nullable: true, isPrimaryKey: false, isForeignKey: false }
      ],
      relationships: [
        { fromTable: 'hr_departments', toTable: 'hr_employees', type: 'one-to-many', description: 'A department has many employees' }
      ]
    },
    {
      name: 'hr_employees',
      displayName: 'Employees',
      rowCount: empCount,
      description: 'Employee information and employment details',
      columns: [
        { name: 'id', type: 'string', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'employeeId', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'firstName', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'lastName', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'position', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'salary', type: 'number', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'departmentId', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: true }
      ],
      relationships: [
        { fromTable: 'hr_employees', toTable: 'hr_departments', type: 'many-to-one', description: 'An employee belongs to one department' }
      ]
    }
  ]
}

async function discoverInventorySchema(): Promise<TableInfo[]> {
  const [warehouseCount, productCount] = await Promise.all([
    prisma.invWarehouse.count(),
    prisma.invProduct.count()
  ])

  return [
    {
      name: 'inv_warehouses',
      displayName: 'Warehouses',
      rowCount: warehouseCount,
      description: 'Warehouse locations',
      columns: [
        { name: 'id', type: 'string', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'name', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'capacity', type: 'number', nullable: false, isPrimaryKey: false, isForeignKey: false }
      ],
      relationships: []
    },
    {
      name: 'inv_products',
      displayName: 'Products',
      rowCount: productCount,
      description: 'Inventory products',
      columns: [
        { name: 'id', type: 'string', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'name', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'unitPrice', type: 'number', nullable: false, isPrimaryKey: false, isForeignKey: false }
      ],
      relationships: []
    }
  ]
}

async function discoverFinanceSchema(): Promise<TableInfo[]> {
  const accountCount = await prisma.finAccount.count()

  return [
    {
      name: 'fin_accounts',
      displayName: 'Accounts',
      rowCount: accountCount,
      description: 'Financial accounts',
      columns: [
        { name: 'id', type: 'string', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'accountName', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'balance', type: 'number', nullable: false, isPrimaryKey: false, isForeignKey: false }
      ],
      relationships: []
    }
  ]
}

async function discoverSupportSchema(): Promise<TableInfo[]> {
  const ticketCount = await prisma.custTicket.count()

  return [
    {
      name: 'cust_tickets',
      displayName: 'Support Tickets',
      rowCount: ticketCount,
      description: 'Customer support tickets',
      columns: [
        { name: 'id', type: 'string', nullable: false, isPrimaryKey: true, isForeignKey: false },
        { name: 'ticketNumber', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'status', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false },
        { name: 'priority', type: 'string', nullable: false, isPrimaryKey: false, isForeignKey: false }
      ],
      relationships: []
    }
  ]
}
