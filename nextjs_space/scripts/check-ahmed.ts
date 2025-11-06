import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const customers = await prisma.salesCustomer.findMany({
    where: {
      lastName: {
        contains: 'Ahmed',
        mode: 'insensitive'
      }
    }
  });
  
  console.log(`\nFound ${customers.length} customers with last name containing "Ahmed":\n`);
  customers.forEach(c => {
    console.log(`- ${c.firstName} ${c.lastName} (${c.email})`);
    console.log(`  Location: ${c.city}, ${c.state}, ${c.country}`);
    console.log(`  Coordinates: ${c.latitude}, ${c.longitude}\n`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
