import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Adding gender data to HR employees...')

  // Get all employees
  const employees = await prisma.hREmployee.findMany()

  console.log(`Found ${employees.length} employees`)

  // Common first names and their typical genders for realistic data
  const maleFirstNames = ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua', 'Kevin', 'Brian', 'George', 'Edward', 'Ronald', 'Timothy', 'Jason', 'Jeffrey', 'Ryan', 'Jacob']
  const femaleFirstNames = ['Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Nancy', 'Lisa', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Dorothy', 'Kimberly', 'Emily', 'Donna', 'Michelle', 'Carol', 'Amanda', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Laura', 'Sharon', 'Cynthia']

  let updated = 0
  for (const employee of employees) {
    let gender = 'Male'
    
    // Assign gender based on first name patterns
    if (femaleFirstNames.includes(employee.firstName)) {
      gender = 'Female'
    } else if (maleFirstNames.includes(employee.firstName)) {
      gender = 'Male'
    } else {
      // For unknown names, assign randomly with some variety
      const rand = Math.random()
      if (rand < 0.47) {
        gender = 'Male'
      } else if (rand < 0.94) {
        gender = 'Female'
      } else if (rand < 0.97) {
        gender = 'Non-binary'
      } else {
        gender = 'Prefer not to say'
      }
    }

    await prisma.hREmployee.update({
      where: { id: employee.id },
      data: { gender }
    })
    
    updated++
    if (updated % 10 === 0) {
      console.log(`Updated ${updated} employees...`)
    }
  }

  console.log(`✅ Successfully updated ${updated} employees with gender data`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
