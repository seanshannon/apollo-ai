import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Checking employee gender data...\n')

  const employees = await prisma.hREmployee.findMany({
    select: {
      firstName: true,
      lastName: true,
      position: true,
      gender: true
    },
    take: 10
  })

  console.log('Sample employees:')
  employees.forEach(emp => {
    console.log(`  ${emp.firstName} ${emp.lastName} (${emp.position}) - Gender: ${emp.gender}`)
  })

  // Count by gender
  const genderCounts = await prisma.hREmployee.groupBy({
    by: ['gender'],
    _count: true
  })

  console.log('\nGender distribution:')
  genderCounts.forEach(g => {
    console.log(`  ${g.gender}: ${g._count} employees`)
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
