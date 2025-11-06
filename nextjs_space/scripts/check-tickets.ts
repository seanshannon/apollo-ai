import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tickets = await prisma.custTicket.findMany({
    take: 10,
    include: {
      customer: true
    }
  });
  
  console.log(`\nFound ${tickets.length} support tickets in database:\n`);
  tickets.forEach(t => {
    console.log(`Ticket #${t.id}: ${t.subject}`);
    console.log(`  Status: ${t.status} | Priority: ${t.priority}`);
    console.log(`  Customer: ${t.customer?.firstName} ${t.customer?.lastName}`);
    console.log(`  Description: ${t.description?.substring(0, 100)}...`);
    console.log('');
  });
  
  // Check total count
  const totalTickets = await prisma.custTicket.count();
  console.log(`\nTotal tickets in database: ${totalTickets}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
