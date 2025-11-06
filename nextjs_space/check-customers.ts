import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCustomers() {
  const total = await prisma.salesCustomer.count();
  const withCoords = await prisma.salesCustomer.count({
    where: {
      AND: [
        { latitude: { not: null } },
        { longitude: { not: null } }
      ]
    }
  });
  
  console.log(`Total customers: ${total}`);
  console.log(`Customers with coordinates: ${withCoords}`);
  
  const sample = await prisma.salesCustomer.findMany({
    take: 3,
    select: { id: true, firstName: true, lastName: true, city: true, country: true, latitude: true, longitude: true }
  });
  
  console.log('\nSample customers:');
  console.log(JSON.stringify(sample, null, 2));
}

checkCustomers().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
