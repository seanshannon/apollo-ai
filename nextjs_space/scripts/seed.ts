
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  try {
    // Create admin user (john@doe.com with johndoe123 password)
    const hashedPassword = await bcrypt.hash('johndoe123', 10)
    await prisma.user.upsert({
      where: { email: 'john@doe.com' },
      update: {},
      create: {
        email: 'john@doe.com',
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        name: 'John Doe',
        role: 'ADMIN',
      },
    })

    // Create test user
    const testPasswordHash = await bcrypt.hash('password123', 10)
    await prisma.user.upsert({
      where: { email: 'test@email.com' },
      update: {},
      create: {
        email: 'test@email.com',
        password: testPasswordHash,
        firstName: 'Test',
        lastName: 'User',
        name: 'Test User',
        role: 'USER',
      },
    })

    console.log('✅ Users created')

    // Seed Sales Database
    await seedSalesDatabase()
    
    // Seed HR Database
    await seedHRDatabase()
    
    // Seed Inventory Database
    await seedInventoryDatabase()
    
    // Seed Finance Database
    await seedFinanceDatabase()
    
    // Seed Customer Support Database
    await seedCustomerSupportDatabase()

    console.log('🎉 Database seeding completed successfully!')

  } catch (error) {
    console.error('❌ Error during seeding:', error)
    throw error
  }
}

async function seedSalesDatabase() {
  console.log('📊 Seeding Sales Database...')

  // Create sales customers
  const customers = await Promise.all([
    prisma.salesCustomer.create({
      data: {
        firstName: 'Michael',
        lastName: 'Johnson',
        email: 'michael.johnson@email.com',
        phone: '555-0101',
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        zipCode: '10001',
        totalSpent: 2500.00,
        dateJoined: new Date('2023-01-15'),
      },
    }),
    prisma.salesCustomer.create({
      data: {
        firstName: 'Sarah',
        lastName: 'Williams',
        email: 'sarah.williams@email.com',
        phone: '555-0102',
        address: '456 Oak Ave',
        city: 'Los Angeles',
        state: 'CA',
        country: 'USA',
        zipCode: '90210',
        totalSpent: 1800.50,
        dateJoined: new Date('2023-02-20'),
      },
    }),
    prisma.salesCustomer.create({
      data: {
        firstName: 'David',
        lastName: 'Brown',
        email: 'david.brown@email.com',
        phone: '555-0103',
        address: '789 Pine St',
        city: 'Chicago',
        state: 'IL',
        country: 'USA',
        zipCode: '60601',
        totalSpent: 3200.75,
        dateJoined: new Date('2022-11-10'),
      },
    }),
    prisma.salesCustomer.create({
      data: {
        firstName: 'Emily',
        lastName: 'Davis',
        email: 'emily.davis@email.com',
        phone: '555-0104',
        address: '321 Elm St',
        city: 'Houston',
        state: 'TX',
        country: 'USA',
        zipCode: '77001',
        totalSpent: 950.25,
        dateJoined: new Date('2023-03-05'),
      },
    }),
    prisma.salesCustomer.create({
      data: {
        firstName: 'Robert',
        lastName: 'Miller',
        email: 'robert.miller@email.com',
        phone: '555-0105',
        address: '654 Cedar Ave',
        city: 'Phoenix',
        state: 'AZ',
        country: 'USA',
        zipCode: '85001',
        totalSpent: 4100.00,
        dateJoined: new Date('2022-09-15'),
      },
    }),
  ])

  // Create sales companies (B2B clients)
  const companies = await Promise.all([
    prisma.salesCompany.create({
      data: {
        companyName: 'TechCorp Solutions',
        industry: 'Technology',
        contactName: 'James Anderson',
        email: 'james@techcorp.com',
        phone: '555-1001',
        address: '100 Tech Plaza',
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        zipCode: '94105',
        website: 'https://techcorp.com',
        employeeCount: 500,
        annualRevenue: 15000000,
        lifetimeValue: 850000,
        contractValue: 250000,
        dateJoined: new Date('2022-01-15'),
        status: 'Active',
        tier: 'Enterprise',
      },
    }),
    prisma.salesCompany.create({
      data: {
        companyName: 'Global Finance Group',
        industry: 'Financial Services',
        contactName: 'Maria Rodriguez',
        email: 'maria@globalfinance.com',
        phone: '555-1002',
        address: '250 Wall Street',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        zipCode: '10005',
        website: 'https://globalfinance.com',
        employeeCount: 1200,
        annualRevenue: 45000000,
        lifetimeValue: 1250000,
        contractValue: 400000,
        dateJoined: new Date('2021-06-20'),
        status: 'Active',
        tier: 'Enterprise',
      },
    }),
    prisma.salesCompany.create({
      data: {
        companyName: 'Healthcare Innovations LLC',
        industry: 'Healthcare',
        contactName: 'Dr. Sarah Chen',
        email: 'sarah@healthinnovations.com',
        phone: '555-1003',
        address: '450 Medical Center Dr',
        city: 'Boston',
        state: 'MA',
        country: 'USA',
        zipCode: '02115',
        website: 'https://healthinnovations.com',
        employeeCount: 300,
        annualRevenue: 8000000,
        lifetimeValue: 620000,
        contractValue: 180000,
        dateJoined: new Date('2022-08-10'),
        status: 'Active',
        tier: 'Professional',
      },
    }),
    prisma.salesCompany.create({
      data: {
        companyName: 'Retail Dynamics Inc',
        industry: 'Retail',
        contactName: 'Michael Thompson',
        email: 'michael@retaildynamics.com',
        phone: '555-1004',
        address: '800 Commerce Blvd',
        city: 'Dallas',
        state: 'TX',
        country: 'USA',
        zipCode: '75201',
        website: 'https://retaildynamics.com',
        employeeCount: 2500,
        annualRevenue: 120000000,
        lifetimeValue: 475000,
        contractValue: 150000,
        dateJoined: new Date('2023-02-01'),
        status: 'Active',
        tier: 'Professional',
      },
    }),
    prisma.salesCompany.create({
      data: {
        companyName: 'EduTech Partners',
        industry: 'Education',
        contactName: 'Jennifer Lee',
        email: 'jennifer@edutechpartners.com',
        phone: '555-1005',
        address: '100 University Ave',
        city: 'Seattle',
        state: 'WA',
        country: 'USA',
        zipCode: '98101',
        website: 'https://edutechpartners.com',
        employeeCount: 150,
        annualRevenue: 5000000,
        lifetimeValue: 285000,
        contractValue: 85000,
        dateJoined: new Date('2023-03-15'),
        status: 'Active',
        tier: 'Standard',
      },
    }),
    prisma.salesCompany.create({
      data: {
        companyName: 'Manufacturing Pro Co',
        industry: 'Manufacturing',
        contactName: 'Robert Davis',
        email: 'robert@manufacturingpro.com',
        phone: '555-1006',
        address: '500 Industrial Park Rd',
        city: 'Detroit',
        state: 'MI',
        country: 'USA',
        zipCode: '48201',
        website: 'https://manufacturingpro.com',
        employeeCount: 800,
        annualRevenue: 35000000,
        lifetimeValue: 920000,
        contractValue: 310000,
        dateJoined: new Date('2021-11-05'),
        status: 'Active',
        tier: 'Enterprise',
      },
    }),
    prisma.salesCompany.create({
      data: {
        companyName: 'Green Energy Solutions',
        industry: 'Energy',
        contactName: 'Amanda Green',
        email: 'amanda@greenenergy.com',
        phone: '555-1007',
        address: '350 Renewable Way',
        city: 'Denver',
        state: 'CO',
        country: 'USA',
        zipCode: '80202',
        website: 'https://greenenergy.com',
        employeeCount: 250,
        annualRevenue: 12000000,
        lifetimeValue: 380000,
        contractValue: 120000,
        dateJoined: new Date('2022-04-20'),
        status: 'Active',
        tier: 'Professional',
      },
    }),
    prisma.salesCompany.create({
      data: {
        companyName: 'Legal Associates Group',
        industry: 'Legal Services',
        contactName: 'David Morrison',
        email: 'david@legalassociates.com',
        phone: '555-1008',
        address: '200 Law Center Plaza',
        city: 'Chicago',
        state: 'IL',
        country: 'USA',
        zipCode: '60601',
        website: 'https://legalassociates.com',
        employeeCount: 75,
        annualRevenue: 6000000,
        lifetimeValue: 195000,
        contractValue: 65000,
        dateJoined: new Date('2023-01-10'),
        status: 'Active',
        tier: 'Standard',
      },
    }),
    prisma.salesCompany.create({
      data: {
        companyName: 'CloudNet Systems',
        industry: 'Cloud Services',
        contactName: 'Lisa Wang',
        email: 'lisa@cloudnetsystems.com',
        phone: '555-1009',
        address: '700 Data Center Dr',
        city: 'Austin',
        state: 'TX',
        country: 'USA',
        zipCode: '78701',
        website: 'https://cloudnetsystems.com',
        employeeCount: 400,
        annualRevenue: 22000000,
        lifetimeValue: 740000,
        contractValue: 220000,
        dateJoined: new Date('2022-07-15'),
        status: 'Active',
        tier: 'Enterprise',
      },
    }),
    prisma.salesCompany.create({
      data: {
        companyName: 'FoodService Distributors',
        industry: 'Food & Beverage',
        contactName: 'Carlos Martinez',
        email: 'carlos@foodservice.com',
        phone: '555-1010',
        address: '400 Distribution Center',
        city: 'Miami',
        state: 'FL',
        country: 'USA',
        zipCode: '33101',
        website: 'https://foodservice.com',
        employeeCount: 600,
        annualRevenue: 28000000,
        lifetimeValue: 310000,
        contractValue: 95000,
        dateJoined: new Date('2023-05-01'),
        status: 'Active',
        tier: 'Professional',
      },
    }),
  ])

  // Create sales products
  const products = await Promise.all([
    prisma.salesProduct.create({
      data: {
        name: 'MacBook Pro 16"',
        description: 'High-performance laptop for professionals',
        price: 2499.00,
        category: 'Laptops',
        sku: 'MBP-16-001',
        stockLevel: 25,
      },
    }),
    prisma.salesProduct.create({
      data: {
        name: 'Dell XPS 13',
        description: 'Ultra-portable business laptop',
        price: 1299.00,
        category: 'Laptops',
        sku: 'XPS-13-001',
        stockLevel: 40,
      },
    }),
    prisma.salesProduct.create({
      data: {
        name: 'iPhone 15 Pro',
        description: 'Latest smartphone with advanced camera',
        price: 999.00,
        category: 'Smartphones',
        sku: 'IPH-15P-001',
        stockLevel: 75,
      },
    }),
    prisma.salesProduct.create({
      data: {
        name: 'iPad Air',
        description: 'Versatile tablet for work and creativity',
        price: 599.00,
        category: 'Tablets',
        sku: 'IPA-AIR-001',
        stockLevel: 50,
      },
    }),
    prisma.salesProduct.create({
      data: {
        name: 'AirPods Pro',
        description: 'Wireless earbuds with noise cancellation',
        price: 249.00,
        category: 'Audio',
        sku: 'APP-PRO-001',
        stockLevel: 100,
      },
    }),
    prisma.salesProduct.create({
      data: {
        name: 'Magic Mouse',
        description: 'Wireless multi-touch mouse',
        price: 79.00,
        category: 'Accessories',
        sku: 'MM-001',
        stockLevel: 60,
      },
    }),
  ])

  // Create sales orders and order items
  for (let i = 0; i < 15; i++) {
    const randomCustomer = customers[Math.floor(Math.random() * customers.length)]
    const orderDate = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000) // Random date within last 90 days
    
    const order = await prisma.salesOrder.create({
      data: {
        orderNumber: `ORD-2024-${(1000 + i).toString()}`,
        customerId: randomCustomer.id,
        orderDate,
        status: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'][Math.floor(Math.random() * 4)] as any,
        totalAmount: 0, // Will update after adding items
        shippingCost: Math.random() < 0.5 ? 0 : 15.99,
        taxAmount: 0, // Will calculate
      },
    })

    // Add 1-3 random items to each order
    const itemCount = Math.floor(Math.random() * 3) + 1
    let orderTotal = 0

    for (let j = 0; j < itemCount; j++) {
      const randomProduct = products[Math.floor(Math.random() * products.length)]
      const quantity = Math.floor(Math.random() * 3) + 1
      const totalPrice = randomProduct.price * quantity

      await prisma.salesOrderItem.create({
        data: {
          orderId: order.id,
          productId: randomProduct.id,
          quantity,
          unitPrice: randomProduct.price,
          totalPrice,
        },
      })

      orderTotal += totalPrice
    }

    // Update order with totals
    const taxAmount = orderTotal * 0.08 // 8% tax
    const finalTotal = orderTotal + order.shippingCost + taxAmount

    await prisma.salesOrder.update({
      where: { id: order.id },
      data: {
        totalAmount: finalTotal,
        taxAmount,
      },
    })
  }

  console.log('✅ Sales Database seeded')
}

async function seedHRDatabase() {
  console.log('👥 Seeding HR Database...')

  // Create departments
  const departments = await Promise.all([
    prisma.hRDepartment.create({
      data: {
        name: 'Sales',
        description: 'Revenue generation and customer acquisition',
        budget: 500000,
      },
    }),
    prisma.hRDepartment.create({
      data: {
        name: 'Engineering',
        description: 'Product development and technology',
        budget: 800000,
      },
    }),
    prisma.hRDepartment.create({
      data: {
        name: 'Marketing',
        description: 'Brand promotion and market research',
        budget: 300000,
      },
    }),
    prisma.hRDepartment.create({
      data: {
        name: 'Human Resources',
        description: 'Employee relations and talent management',
        budget: 200000,
      },
    }),
    prisma.hRDepartment.create({
      data: {
        name: 'Finance',
        description: 'Financial planning and accounting',
        budget: 250000,
      },
    }),
  ])

  // Create employees
  const employees = await Promise.all([
    // Sales Department
    prisma.hREmployee.create({
      data: {
        employeeId: 'EMP001',
        firstName: 'Alice',
        lastName: 'Cooper',
        email: 'alice.cooper@company.com',
        phone: '555-1001',
        position: 'Sales Manager',
        departmentId: departments[0].id,
        salary: 95000,
        hireDate: new Date('2022-03-15'),
        status: 'ACTIVE',
      },
    }),
    prisma.hREmployee.create({
      data: {
        employeeId: 'EMP002',
        firstName: 'Bob',
        lastName: 'Wilson',
        email: 'bob.wilson@company.com',
        phone: '555-1002',
        position: 'Sales Representative',
        departmentId: departments[0].id,
        salary: 65000,
        hireDate: new Date('2023-01-20'),
        status: 'ACTIVE',
      },
    }),
    // Engineering Department
    prisma.hREmployee.create({
      data: {
        employeeId: 'EMP003',
        firstName: 'Charlie',
        lastName: 'Tech',
        email: 'charlie.tech@company.com',
        phone: '555-1003',
        position: 'Senior Software Engineer',
        departmentId: departments[1].id,
        salary: 120000,
        hireDate: new Date('2021-06-10'),
        status: 'ACTIVE',
      },
    }),
    prisma.hREmployee.create({
      data: {
        employeeId: 'EMP004',
        firstName: 'Diana',
        lastName: 'Code',
        email: 'diana.code@company.com',
        phone: '555-1004',
        position: 'Frontend Developer',
        departmentId: departments[1].id,
        salary: 85000,
        hireDate: new Date('2022-09-05'),
        status: 'ACTIVE',
      },
    }),
    // Marketing Department
    prisma.hREmployee.create({
      data: {
        employeeId: 'EMP005',
        firstName: 'Eve',
        lastName: 'Brand',
        email: 'eve.brand@company.com',
        phone: '555-1005',
        position: 'Marketing Director',
        departmentId: departments[2].id,
        salary: 110000,
        hireDate: new Date('2021-11-12'),
        status: 'ACTIVE',
      },
    }),
    prisma.hREmployee.create({
      data: {
        employeeId: 'EMP006',
        firstName: 'Frank',
        lastName: 'Content',
        email: 'frank.content@company.com',
        phone: '555-1006',
        position: 'Content Marketing Specialist',
        departmentId: departments[2].id,
        salary: 55000,
        hireDate: new Date('2023-04-18'),
        status: 'ACTIVE',
      },
    }),
    // HR Department
    prisma.hREmployee.create({
      data: {
        employeeId: 'EMP007',
        firstName: 'Grace',
        lastName: 'People',
        email: 'grace.people@company.com',
        phone: '555-1007',
        position: 'HR Director',
        departmentId: departments[3].id,
        salary: 105000,
        hireDate: new Date('2020-08-01'),
        status: 'ACTIVE',
      },
    }),
    // Finance Department
    prisma.hREmployee.create({
      data: {
        employeeId: 'EMP008',
        firstName: 'Henry',
        lastName: 'Numbers',
        email: 'henry.numbers@company.com',
        phone: '555-1008',
        position: 'Financial Analyst',
        departmentId: departments[4].id,
        salary: 75000,
        hireDate: new Date('2022-12-03'),
        status: 'ACTIVE',
      },
    }),
  ])

  // Update departments with managers
  await prisma.hRDepartment.update({
    where: { id: departments[0].id },
    data: { managerId: employees[0].id },
  })
  await prisma.hRDepartment.update({
    where: { id: departments[1].id },
    data: { managerId: employees[2].id },
  })
  await prisma.hRDepartment.update({
    where: { id: departments[2].id },
    data: { managerId: employees[4].id },
  })
  await prisma.hRDepartment.update({
    where: { id: departments[3].id },
    data: { managerId: employees[6].id },
  })

  // Create performance reviews
  for (const employee of employees) {
    await prisma.hRPerformance.create({
      data: {
        employeeId: employee.id,
        reviewDate: new Date('2024-01-15'),
        rating: Math.random() * 2 + 3, // Rating between 3-5
        goals: 'Improve technical skills and team collaboration',
        feedback: 'Strong performer with good potential for growth',
        reviewer: 'Manager',
      },
    })
  }

  console.log('✅ HR Database seeded')
}

async function seedInventoryDatabase() {
  console.log('📦 Seeding Inventory Database...')

  // Create warehouses
  const warehouses = await Promise.all([
    prisma.invWarehouse.create({
      data: {
        name: 'East Coast Warehouse',
        address: '100 Industrial Blvd',
        city: 'Newark',
        state: 'NJ',
        country: 'USA',
        capacity: 10000,
        managerId: 'WM001',
      },
    }),
    prisma.invWarehouse.create({
      data: {
        name: 'West Coast Warehouse',
        address: '200 Logistics Way',
        city: 'Los Angeles',
        state: 'CA',
        country: 'USA',
        capacity: 15000,
        managerId: 'WM002',
      },
    }),
    prisma.invWarehouse.create({
      data: {
        name: 'Central Distribution Center',
        address: '300 Supply Chain Dr',
        city: 'Dallas',
        state: 'TX',
        country: 'USA',
        capacity: 20000,
        managerId: 'WM003',
      },
    }),
  ])

  // Create suppliers
  const suppliers = await Promise.all([
    prisma.invSupplier.create({
      data: {
        name: 'TechCorp Solutions',
        contactName: 'John Technical',
        email: 'orders@techcorp.com',
        phone: '555-2001',
        address: '123 Tech Ave',
        city: 'San Jose',
        state: 'CA',
        country: 'USA',
      },
    }),
    prisma.invSupplier.create({
      data: {
        name: 'Global Electronics',
        contactName: 'Sarah Electronic',
        email: 'supply@globalelec.com',
        phone: '555-2002',
        address: '456 Circuit St',
        city: 'Austin',
        state: 'TX',
        country: 'USA',
      },
    }),
    prisma.invSupplier.create({
      data: {
        name: 'Premium Components',
        contactName: 'Mike Component',
        email: 'info@premiumcomp.com',
        phone: '555-2003',
        address: '789 Parts Blvd',
        city: 'Denver',
        state: 'CO',
        country: 'USA',
      },
    }),
  ])

  // Create inventory products
  const invProducts = await Promise.all([
    prisma.invProduct.create({
      data: {
        name: 'High-End Laptop',
        description: 'Professional grade laptop for business use',
        sku: 'INV-LAP-001',
        category: 'Computers',
        unitPrice: 1299.99,
        supplierId: suppliers[0].id,
        minStock: 10,
        maxStock: 100,
      },
    }),
    prisma.invProduct.create({
      data: {
        name: 'Wireless Mouse Pro',
        description: 'Ergonomic wireless mouse with precision tracking',
        sku: 'INV-MOU-001',
        category: 'Accessories',
        unitPrice: 89.99,
        supplierId: suppliers[1].id,
        minStock: 25,
        maxStock: 200,
      },
    }),
    prisma.invProduct.create({
      data: {
        name: '4K Monitor',
        description: '27-inch 4K display for professional work',
        sku: 'INV-MON-001',
        category: 'Displays',
        unitPrice: 499.99,
        supplierId: suppliers[0].id,
        minStock: 5,
        maxStock: 50,
      },
    }),
    prisma.invProduct.create({
      data: {
        name: 'Mechanical Keyboard',
        description: 'Premium mechanical keyboard with backlight',
        sku: 'INV-KEY-001',
        category: 'Accessories',
        unitPrice: 179.99,
        supplierId: suppliers[2].id,
        minStock: 15,
        maxStock: 75,
      },
    }),
    prisma.invProduct.create({
      data: {
        name: 'Webcam HD Pro',
        description: 'High-definition webcam for video conferencing',
        sku: 'INV-CAM-001',
        category: 'Accessories',
        unitPrice: 129.99,
        supplierId: suppliers[1].id,
        minStock: 20,
        maxStock: 100,
      },
    }),
  ])

  // Create inventory records
  for (const product of invProducts) {
    for (const warehouse of warehouses) {
      const quantity = Math.floor(Math.random() * 80) + 10 // Random quantity between 10-90
      const reserved = Math.floor(Math.random() * Math.min(quantity, 20)) // Random reserved up to 20 or quantity

      await prisma.invInventory.create({
        data: {
          productId: product.id,
          warehouseId: warehouse.id,
          quantity,
          reservedQty: reserved,
        },
      })
    }
  }

  console.log('✅ Inventory Database seeded')
}

async function seedFinanceDatabase() {
  console.log('💰 Seeding Finance Database...')

  // Create financial accounts
  const accounts = await Promise.all([
    prisma.finAccount.create({
      data: {
        accountName: 'Operating Account',
        accountType: 'ASSET',
        balance: 150000.00,
        currency: 'USD',
        isActive: true,
      },
    }),
    prisma.finAccount.create({
      data: {
        accountName: 'Marketing Budget',
        accountType: 'EXPENSE',
        balance: 75000.00,
        currency: 'USD',
        isActive: true,
      },
    }),
    prisma.finAccount.create({
      data: {
        accountName: 'Sales Revenue',
        accountType: 'REVENUE',
        balance: 500000.00,
        currency: 'USD',
        isActive: true,
      },
    }),
    prisma.finAccount.create({
      data: {
        accountName: 'Office Expenses',
        accountType: 'EXPENSE',
        balance: 25000.00,
        currency: 'USD',
        isActive: true,
      },
    }),
    prisma.finAccount.create({
      data: {
        accountName: 'Equipment Fund',
        accountType: 'ASSET',
        balance: 100000.00,
        currency: 'USD',
        isActive: true,
      },
    }),
  ])

  // Create transactions for each account
  const categories = ['Office Supplies', 'Software Licenses', 'Marketing Campaigns', 'Equipment Purchase', 'Travel', 'Consulting', 'Utilities']
  
  for (const account of accounts) {
    // Create 10-20 random transactions per account
    const transactionCount = Math.floor(Math.random() * 11) + 10
    
    for (let i = 0; i < transactionCount; i++) {
      const isDebit = Math.random() < 0.5
      const amount = Math.random() * 5000 + 100 // Random amount between 100-5100
      const transactionDate = new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000) // Random date within last 180 days
      const category = categories[Math.floor(Math.random() * categories.length)]

      await prisma.finTransaction.create({
        data: {
          accountId: account.id,
          amount,
          type: isDebit ? 'DEBIT' : 'CREDIT',
          category,
          description: `${category} - Transaction ${i + 1}`,
          reference: `TXN-${Date.now()}-${i}`,
          transactionDate,
        },
      })
    }
  }

  // Create budget entries
  const budgetCategories = ['Marketing', 'Engineering', 'Sales', 'Operations', 'HR', 'Travel', 'Equipment']
  
  for (const category of budgetCategories) {
    const allocated = Math.random() * 50000 + 10000 // Random budget between 10k-60k
    const spent = Math.random() * allocated * 0.8 // Spent up to 80% of allocated
    
    await prisma.finBudget.create({
      data: {
        category,
        budgetYear: 2024,
        budgetMonth: null, // Annual budget
        allocated,
        spent,
        remaining: allocated - spent,
      },
    })

    // Create quarterly budgets for some categories
    if (Math.random() < 0.5) {
      for (let quarter = 1; quarter <= 4; quarter++) {
        const quarterlyAllocated = allocated / 4
        const quarterlySpent = Math.random() * quarterlyAllocated * 0.9
        
        await prisma.finBudget.create({
          data: {
            category: `${category} Q${quarter}`,
            budgetYear: 2024,
            budgetMonth: quarter * 3, // March, June, September, December
            allocated: quarterlyAllocated,
            spent: quarterlySpent,
            remaining: quarterlyAllocated - quarterlySpent,
          },
        })
      }
    }
  }

  console.log('✅ Finance Database seeded')
}

async function seedCustomerSupportDatabase() {
  console.log('🎧 Seeding Customer Support Database...')

  // Create support customers
  const supportCustomers = await Promise.all([
    prisma.custCustomer.create({
      data: {
        firstName: 'Jennifer',
        lastName: 'Smith',
        email: 'jennifer.smith@example.com',
        phone: '555-3001',
        company: 'Acme Corp',
        tier: 'PREMIUM',
        status: 'ACTIVE',
        joinDate: new Date('2023-01-15'),
        lastContact: new Date('2024-01-10'),
      },
    }),
    prisma.custCustomer.create({
      data: {
        firstName: 'James',
        lastName: 'Wilson',
        email: 'james.wilson@example.com',
        phone: '555-3002',
        company: 'Tech Solutions Inc',
        tier: 'ENTERPRISE',
        status: 'ACTIVE',
        joinDate: new Date('2022-06-20'),
        lastContact: new Date('2024-01-08'),
      },
    }),
    prisma.custCustomer.create({
      data: {
        firstName: 'Maria',
        lastName: 'Garcia',
        email: 'maria.garcia@example.com',
        phone: '555-3003',
        company: 'Startup Ventures',
        tier: 'STANDARD',
        status: 'ACTIVE',
        joinDate: new Date('2023-09-10'),
        lastContact: new Date('2024-01-12'),
      },
    }),
    prisma.custCustomer.create({
      data: {
        firstName: 'Alex',
        lastName: 'Johnson',
        email: 'alex.johnson@example.com',
        phone: '555-3004',
        company: 'Local Business LLC',
        tier: 'BASIC',
        status: 'ACTIVE',
        joinDate: new Date('2023-11-05'),
        lastContact: new Date('2024-01-05'),
      },
    }),
    prisma.custCustomer.create({
      data: {
        firstName: 'Lisa',
        lastName: 'Brown',
        email: 'lisa.brown@example.com',
        phone: '555-3005',
        company: 'Enterprise Solutions',
        tier: 'ENTERPRISE',
        status: 'INACTIVE',
        joinDate: new Date('2022-03-12'),
        lastContact: new Date('2023-12-15'),
      },
    }),
  ])

  // Create support tickets
  const ticketSubjects = [
    'Login Issues',
    'Payment Processing Error',
    'Feature Request',
    'Bug Report',
    'Account Setup Help',
    'Data Export Problem',
    'Integration Questions',
    'Performance Issues',
    'Security Concerns',
    'Billing Inquiry'
  ]

  const ticketCategories = ['Technical', 'Billing', 'Account', 'Feature Request', 'Bug Report', 'General Inquiry']

  const tickets = []
  for (let i = 0; i < 25; i++) {
    const customer = supportCustomers[Math.floor(Math.random() * supportCustomers.length)]
    const subject = ticketSubjects[Math.floor(Math.random() * ticketSubjects.length)]
    const category = ticketCategories[Math.floor(Math.random() * ticketCategories.length)]
    const priority = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'][Math.floor(Math.random() * 4)] as any
    const status = ['OPEN', 'IN_PROGRESS', 'PENDING_CUSTOMER', 'RESOLVED', 'CLOSED'][Math.floor(Math.random() * 5)] as any
    const createdDate = new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000) // Random date within last 60 days

    const ticket = await prisma.custTicket.create({
      data: {
        ticketNumber: `TKT-2024-${(1000 + i).toString()}`,
        customerId: customer.id,
        subject,
        description: `Customer reported: ${subject}. This needs to be addressed promptly.`,
        priority,
        status,
        assignedTo: Math.random() < 0.8 ? `Agent ${Math.floor(Math.random() * 5) + 1}` : null,
        category,
        resolution: status === 'RESOLVED' || status === 'CLOSED' ? 'Issue resolved successfully' : null,
        createdAt: createdDate,
        updatedAt: new Date(createdDate.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000), // Updated within 7 days
        resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? new Date(createdDate.getTime() + Math.random() * 14 * 24 * 60 * 60 * 1000) : null,
      },
    })

    tickets.push(ticket)
  }

  // Create customer interactions
  const interactionTypes = ['INQUIRY', 'COMPLAINT', 'SUPPORT', 'SALES', 'FOLLOW_UP'] as const
  const channels = ['email', 'phone', 'chat', 'web form']

  for (const customer of supportCustomers) {
    // Create 2-5 interactions per customer
    const interactionCount = Math.floor(Math.random() * 4) + 2
    
    for (let i = 0; i < interactionCount; i++) {
      const type = interactionTypes[Math.floor(Math.random() * interactionTypes.length)]
      const channel = channels[Math.floor(Math.random() * channels.length)]
      const customerTicket = tickets.find(t => t.customerId === customer.id && Math.random() < 0.3) // 30% chance to link to ticket
      
      await prisma.custInteraction.create({
        data: {
          customerId: customer.id,
          ticketId: customerTicket?.id || null,
          type,
          channel,
          subject: `${type} via ${channel}`,
          notes: `Customer interaction of type ${type} handled via ${channel}. Positive customer experience.`,
          agentName: `Agent ${Math.floor(Math.random() * 10) + 1}`,
          duration: channel === 'phone' ? Math.floor(Math.random() * 45) + 5 : null, // 5-50 minutes for phone calls
          createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000), // Random date within last 90 days
        },
      })
    }
  }

  console.log('✅ Customer Support Database seeded')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
