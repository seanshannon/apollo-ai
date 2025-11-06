import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Fixing incorrect gender assignments...\n')

  // Fix Alice Cooper - should be Female
  await prisma.hREmployee.updateMany({
    where: { firstName: 'Alice', lastName: 'Cooper' },
    data: { gender: 'Female' }
  })
  console.log('✓ Fixed Alice Cooper -> Female')

  // Fix Charlie Tech - should be Male
  await prisma.hREmployee.updateMany({
    where: { firstName: 'Charlie', lastName: 'Tech' },
    data: { gender: 'Male' }
  })
  console.log('✓ Fixed Charlie Tech -> Male')

  // Fix Bob Wilson - should be Male
  await prisma.hREmployee.updateMany({
    where: { firstName: 'Bob', lastName: 'Wilson' },
    data: { gender: 'Male' }
  })
  console.log('✓ Fixed Bob Wilson -> Male')

  // Fix Henry Numbers - should be Male
  await prisma.hREmployee.updateMany({
    where: { firstName: 'Henry', lastName: 'Numbers' },
    data: { gender: 'Male' }
  })
  console.log('✓ Fixed Henry Numbers -> Male')

  console.log('\n✅ All gender assignments corrected!')

  // Show updated distribution
  const genderCounts = await prisma.hREmployee.groupBy({
    by: ['gender'],
    _count: true
  })

  console.log('\nUpdated gender distribution:')
  genderCounts.forEach(g => {
    console.log(`  ${g.gender}: ${g._count} employees`)
  })

  // Show all employees with corrected data
  console.log('\nAll employees:')
  const allEmployees = await prisma.hREmployee.findMany({
    select: {
      firstName: true,
      lastName: true,
      position: true,
      gender: true
    },
    orderBy: { firstName: 'asc' }
  })

  allEmployees.forEach(emp => {
    console.log(`  ${emp.firstName} ${emp.lastName} (${emp.position}) - ${emp.gender}`)
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
