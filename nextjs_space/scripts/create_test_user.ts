import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createTestUsers() {
  try {
    // Create test@picard.ai user
    const hashedPassword1 = await bcrypt.hash('Test123!@#', 10)
    const user1 = await prisma.user.upsert({
      where: { email: 'test@picard.ai' },
      update: {},
      create: {
        email: 'test@picard.ai',
        password: hashedPassword1,
        firstName: 'Test',
        lastName: 'User',
        name: 'Test User',
        role: 'USER',
      },
    })
    console.log('✅ Test user created:', user1.email)

    // Ensure john@doe.com exists
    const hashedPassword2 = await bcrypt.hash('johndoe123', 10)
    const user2 = await prisma.user.upsert({
      where: { email: 'john@doe.com' },
      update: {},
      create: {
        email: 'john@doe.com',
        password: hashedPassword2,
        firstName: 'John',
        lastName: 'Doe',
        name: 'John Doe',
        role: 'ADMIN',
      },
    })
    console.log('✅ Admin user created:', user2.email)

    console.log('\nTest Credentials:')
    console.log('User: test@picard.ai / Test123!@#')
    console.log('Admin: john@doe.com / johndoe123')
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestUsers()
