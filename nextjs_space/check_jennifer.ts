import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkJennifer() {
  // Check if Jennifer Smith exists
  const jennifer = await prisma.custCustomer.findFirst({
    where: {
      firstName: 'Jennifer',
      lastName: 'Smith'
    },
    include: {
      tickets: true
    }
  })
  
  console.log('Jennifer Smith:', JSON.stringify(jennifer, null, 2))
  
  // Check all tickets with login issues
  const loginTickets = await prisma.custTicket.findMany({
    where: {
      OR: [
        { subject: { contains: 'login', mode: 'insensitive' } },
        { subject: { contains: 'log in', mode: 'insensitive' } },
        { description: { contains: 'login', mode: 'insensitive' } }
      ]
    },
    include: {
      customer: true
    }
  })
  
  console.log('\n\nLogin tickets:', loginTickets.length)
  loginTickets.forEach(ticket => {
    console.log(`- ${ticket.ticketNumber}: ${ticket.subject} (Customer: ${ticket.customer.firstName} ${ticket.customer.lastName})`)
  })
  
  await prisma.$disconnect()
}

checkJennifer().catch(console.error)
