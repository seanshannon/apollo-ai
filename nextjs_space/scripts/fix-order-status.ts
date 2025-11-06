import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fixing OrderStatus enum values...');
  
  try {
    // Step 1: Alter column to text to bypass enum constraint
    console.log('Step 1: Converting status column to text...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "sales_orders" 
      ALTER COLUMN status TYPE text
    `);
    
    // Step 2: Fix the incorrect values
    console.log('Step 2: Updating incorrect values...');
    const result = await prisma.$executeRawUnsafe(`
      UPDATE "sales_orders"
      SET status = 'CANCELLED'
      WHERE status = 'Cancelled'
    `);
    
    console.log(`Fixed ${result} order(s) with incorrect status casing`);
    
    // Step 3: Alter column back to OrderStatus enum
    console.log('Step 3: Converting status column back to OrderStatus enum...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "sales_orders" 
      ALTER COLUMN status TYPE "OrderStatus" USING status::"OrderStatus"
    `);
    
    // Step 4: Verify the fix
    console.log('Step 4: Verifying the fix...');
    const orders = await prisma.$queryRawUnsafe(`
      SELECT status, COUNT(*) as count
      FROM "sales_orders"
      GROUP BY status
    `);
    
    console.log('\nCurrent order status distribution:');
    console.log(orders);
    console.log('\n✓ Successfully fixed all order statuses!');
    
  } catch (error) {
    console.error('Error fixing order statuses:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
