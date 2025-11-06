import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
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
  
  console.log('Jennifer Smith:', jennifer ? `Found! ID: ${jennifer.id}, Email: ${jennifer.email}, Tickets: ${jennifer.tickets.length}` : 'NOT FOUND')
  if (jennifer && jennifer.tickets.length > 0) {
    console.log('\nHer tickets:')
    jennifer.tickets.forEach(t => {
      console.log(`  - ${t.ticketNumber}: ${t.subject} (Status: ${t.status})`)
      console.log(`    Resolution: ${t.resolution || 'None'}`)
    })
  }
  
  // Check all login tickets
  console.log('\n\n=== ALL LOGIN-RELATED TICKETS ===')
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
    },
    take: 15
  })
  
  console.log(`Found ${loginTickets.length} login-related tickets:\n`)
  loginTickets.forEach(ticket => {
    console.log(`${ticket.ticketNumber}: ${ticket.subject}`)
    console.log(`  Customer: ${ticket.customer.firstName} ${ticket.customer.lastName}`)
    console.log(`  Status: ${ticket.status}`)
    console.log(`  Resolution: ${ticket.resolution || 'None'}`)
    console.log('')
  })
  
  await prisma.$disconnect()
}

main().catch(console.error)
