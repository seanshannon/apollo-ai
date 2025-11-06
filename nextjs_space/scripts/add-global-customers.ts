
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Global cities with coordinates
const globalCities = [
  // North America
  { city: 'New York', state: 'NY', country: 'USA', lat: 40.7128, lon: -74.0060, phone: '+1' },
  { city: 'Los Angeles', state: 'CA', country: 'USA', lat: 34.0522, lon: -118.2437, phone: '+1' },
  { city: 'Chicago', state: 'IL', country: 'USA', lat: 41.8781, lon: -87.6298, phone: '+1' },
  { city: 'Houston', state: 'TX', country: 'USA', lat: 29.7604, lon: -95.3698, phone: '+1' },
  { city: 'Phoenix', state: 'AZ', country: 'USA', lat: 33.4484, lon: -112.0740, phone: '+1' },
  { city: 'Philadelphia', state: 'PA', country: 'USA', lat: 39.9526, lon: -75.1652, phone: '+1' },
  { city: 'San Antonio', state: 'TX', country: 'USA', lat: 29.4241, lon: -98.4936, phone: '+1' },
  { city: 'San Diego', state: 'CA', country: 'USA', lat: 32.7157, lon: -117.1611, phone: '+1' },
  { city: 'Dallas', state: 'TX', country: 'USA', lat: 32.7767, lon: -96.7970, phone: '+1' },
  { city: 'San Jose', state: 'CA', country: 'USA', lat: 37.3382, lon: -121.8863, phone: '+1' },
  { city: 'Austin', state: 'TX', country: 'USA', lat: 30.2672, lon: -97.7431, phone: '+1' },
  { city: 'Seattle', state: 'WA', country: 'USA', lat: 47.6062, lon: -122.3321, phone: '+1' },
  { city: 'Denver', state: 'CO', country: 'USA', lat: 39.7392, lon: -104.9903, phone: '+1' },
  { city: 'Boston', state: 'MA', country: 'USA', lat: 42.3601, lon: -71.0589, phone: '+1' },
  { city: 'Miami', state: 'FL', country: 'USA', lat: 25.7617, lon: -80.1918, phone: '+1' },
  { city: 'Toronto', state: 'ON', country: 'Canada', lat: 43.6532, lon: -79.3832, phone: '+1' },
  { city: 'Vancouver', state: 'BC', country: 'Canada', lat: 49.2827, lon: -123.1207, phone: '+1' },
  { city: 'Montreal', state: 'QC', country: 'Canada', lat: 45.5017, lon: -73.5673, phone: '+1' },
  { city: 'Mexico City', state: 'CDMX', country: 'Mexico', lat: 19.4326, lon: -99.1332, phone: '+52' },
  
  // South America
  { city: 'São Paulo', state: 'SP', country: 'Brazil', lat: -23.5505, lon: -46.6333, phone: '+55' },
  { city: 'Rio de Janeiro', state: 'RJ', country: 'Brazil', lat: -22.9068, lon: -43.1729, phone: '+55' },
  { city: 'Buenos Aires', state: 'BA', country: 'Argentina', lat: -34.6037, lon: -58.3816, phone: '+54' },
  { city: 'Lima', state: 'LIM', country: 'Peru', lat: -12.0464, lon: -77.0428, phone: '+51' },
  { city: 'Bogotá', state: 'BOG', country: 'Colombia', lat: 4.7110, lon: -74.0721, phone: '+57' },
  { city: 'Santiago', state: 'RM', country: 'Chile', lat: -33.4489, lon: -70.6693, phone: '+56' },
  
  // Europe
  { city: 'London', state: 'ENG', country: 'United Kingdom', lat: 51.5074, lon: -0.1278, phone: '+44' },
  { city: 'Paris', state: 'IDF', country: 'France', lat: 48.8566, lon: 2.3522, phone: '+33' },
  { city: 'Berlin', state: 'BE', country: 'Germany', lat: 52.5200, lon: 13.4050, phone: '+49' },
  { city: 'Madrid', state: 'MD', country: 'Spain', lat: 40.4168, lon: -3.7038, phone: '+34' },
  { city: 'Rome', state: 'LAZ', country: 'Italy', lat: 41.9028, lon: 12.4964, phone: '+39' },
  { city: 'Amsterdam', state: 'NH', country: 'Netherlands', lat: 52.3676, lon: 4.9041, phone: '+31' },
  { city: 'Barcelona', state: 'CT', country: 'Spain', lat: 41.3851, lon: 2.1734, phone: '+34' },
  { city: 'Munich', state: 'BY', country: 'Germany', lat: 48.1351, lon: 11.5820, phone: '+49' },
  { city: 'Milan', state: 'LOM', country: 'Italy', lat: 45.4642, lon: 9.1900, phone: '+39' },
  { city: 'Vienna', state: 'VIE', country: 'Austria', lat: 48.2082, lon: 16.3738, phone: '+43' },
  { city: 'Stockholm', state: 'STO', country: 'Sweden', lat: 59.3293, lon: 18.0686, phone: '+46' },
  { city: 'Copenhagen', state: 'CPH', country: 'Denmark', lat: 55.6761, lon: 12.5683, phone: '+45' },
  { city: 'Dublin', state: 'DUB', country: 'Ireland', lat: 53.3498, lon: -6.2603, phone: '+353' },
  { city: 'Warsaw', state: 'MAZ', country: 'Poland', lat: 52.2297, lon: 21.0122, phone: '+48' },
  { city: 'Prague', state: 'PRA', country: 'Czech Republic', lat: 50.0755, lon: 14.4378, phone: '+420' },
  
  // Asia
  { city: 'Tokyo', state: 'TKY', country: 'Japan', lat: 35.6762, lon: 139.6503, phone: '+81' },
  { city: 'Singapore', state: 'SG', country: 'Singapore', lat: 1.3521, lon: 103.8198, phone: '+65' },
  { city: 'Seoul', state: 'SEO', country: 'South Korea', lat: 37.5665, lon: 126.9780, phone: '+82' },
  { city: 'Hong Kong', state: 'HK', country: 'Hong Kong', lat: 22.3193, lon: 114.1694, phone: '+852' },
  { city: 'Shanghai', state: 'SH', country: 'China', lat: 31.2304, lon: 121.4737, phone: '+86' },
  { city: 'Beijing', state: 'BJ', country: 'China', lat: 39.9042, lon: 116.4074, phone: '+86' },
  { city: 'Mumbai', state: 'MH', country: 'India', lat: 19.0760, lon: 72.8777, phone: '+91' },
  { city: 'Delhi', state: 'DL', country: 'India', lat: 28.7041, lon: 77.1025, phone: '+91' },
  { city: 'Bangalore', state: 'KA', country: 'India', lat: 12.9716, lon: 77.5946, phone: '+91' },
  { city: 'Bangkok', state: 'BKK', country: 'Thailand', lat: 13.7563, lon: 100.5018, phone: '+66' },
  { city: 'Dubai', state: 'DXB', country: 'UAE', lat: 25.2048, lon: 55.2708, phone: '+971' },
  { city: 'Tel Aviv', state: 'TA', country: 'Israel', lat: 32.0853, lon: 34.7818, phone: '+972' },
  { city: 'Jakarta', state: 'JKT', country: 'Indonesia', lat: -6.2088, lon: 106.8456, phone: '+62' },
  { city: 'Manila', state: 'MNL', country: 'Philippines', lat: 14.5995, lon: 120.9842, phone: '+63' },
  { city: 'Kuala Lumpur', state: 'KL', country: 'Malaysia', lat: 3.1390, lon: 101.6869, phone: '+60' },
  
  // Oceania
  { city: 'Sydney', state: 'NSW', country: 'Australia', lat: -33.8688, lon: 151.2093, phone: '+61' },
  { city: 'Melbourne', state: 'VIC', country: 'Australia', lat: -37.8136, lon: 144.9631, phone: '+61' },
  { city: 'Brisbane', state: 'QLD', country: 'Australia', lat: -27.4698, lon: 153.0251, phone: '+61' },
  { city: 'Auckland', state: 'AKL', country: 'New Zealand', lat: -36.8485, lon: 174.7633, phone: '+64' },
  
  // Africa
  { city: 'Cairo', state: 'CAI', country: 'Egypt', lat: 30.0444, lon: 31.2357, phone: '+20' },
  { city: 'Lagos', state: 'LAG', country: 'Nigeria', lat: 6.5244, lon: 3.3792, phone: '+234' },
  { city: 'Johannesburg', state: 'GP', country: 'South Africa', lat: -26.2041, lon: 28.0473, phone: '+27' },
  { city: 'Nairobi', state: 'NBO', country: 'Kenya', lat: -1.2921, lon: 36.8219, phone: '+254' },
  { city: 'Cape Town', state: 'WC', country: 'South Africa', lat: -33.9249, lon: 18.4241, phone: '+27' },
]

// First names from various cultures
const firstNames = [
  // English
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth',
  'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen',
  'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra',
  
  // Spanish
  'José', 'María', 'Juan', 'Carmen', 'Luis', 'Isabel', 'Carlos', 'Ana', 'Miguel', 'Rosa',
  'Pedro', 'Laura', 'Fernando', 'Elena', 'Diego', 'Sofia', 'Alejandro', 'Marta', 'Pablo', 'Lucía',
  
  // French
  'Pierre', 'Marie', 'Jean', 'Sophie', 'Jacques', 'Nathalie', 'Michel', 'Isabelle', 'Philippe', 'Camille',
  
  // German
  'Hans', 'Anna', 'Peter', 'Emma', 'Klaus', 'Lena', 'Wolfgang', 'Sophie', 'Dieter', 'Maria',
  
  // Asian
  'Wei', 'Ling', 'Chen', 'Mei', 'Yuki', 'Sakura', 'Raj', 'Priya', 'Mohammed', 'Fatima',
  'Hiroshi', 'Aiko', 'Haruto', 'Yui', 'Kumar', 'Deepa', 'Ahmed', 'Aisha', 'Ravi', 'Sita',
  
  // Italian
  'Marco', 'Giulia', 'Luca', 'Francesca', 'Andrea', 'Chiara', 'Matteo', 'Sara', 'Alessandro', 'Elena',
  
  // Russian
  'Ivan', 'Olga', 'Dmitri', 'Natasha', 'Sergei', 'Svetlana', 'Alexei', 'Tatiana', 'Mikhail', 'Irina',
  
  // Portuguese
  'João', 'Ana', 'Carlos', 'Beatriz', 'Ricardo', 'Juliana', 'Fernando', 'Camila', 'Paulo', 'Mariana',
  
  // African
  'Kwame', 'Amina', 'Kofi', 'Zara', 'Jabari', 'Nia', 'Tariq', 'Ayana', 'Omar', 'Sanaa',
  
  // Scandinavian
  'Lars', 'Ingrid', 'Erik', 'Astrid', 'Olaf', 'Freya', 'Magnus', 'Liv', 'Sven', 'Elsa',
]

// Last names from various cultures
const lastNames = [
  // English
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'White', 'Harris', 'Thompson', 'Robinson', 'Clark', 'Lewis', 'Walker', 'Hall', 'Young',
  
  // Spanish
  'Fernández', 'González', 'Rodríguez', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín', 'Jiménez',
  
  // French
  'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Petit', 'Richard', 'Durand', 'Leroy', 'Moreau',
  
  // German
  'Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann',
  
  // Asian
  'Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Huang', 'Zhao', 'Wu', 'Zhou',
  'Tanaka', 'Suzuki', 'Takahashi', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato', 'Yoshida',
  'Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Jang', 'Lim',
  'Sharma', 'Kumar', 'Singh', 'Patel', 'Gupta', 'Khan', 'Ali', 'Ahmed', 'Hassan', 'Hussein',
  
  // Italian
  'Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco',
  
  // Russian
  'Ivanov', 'Petrov', 'Sidorov', 'Kozlov', 'Smirnov', 'Popov', 'Volkov', 'Sokolov', 'Lebedev', 'Novikov',
  
  // Portuguese
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes',
  
  // African
  'Okafor', 'Nwankwo', 'Kamau', 'Mwangi', 'Ngugi', 'Nkosi', 'Dlamini', 'Khumalo', 'Mohamed', 'Ibrahim',
  
  // Scandinavian
  'Johansson', 'Andersson', 'Karlsson', 'Nilsson', 'Eriksson', 'Larsson', 'Olsson', 'Persson', 'Svensson', 'Gustafsson',
]

function generateEmail(firstName: string, lastName: string, index: number): string {
  const providers = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'email.com']
  const provider = providers[Math.floor(Math.random() * providers.length)]
  const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, '')
  const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '')
  return `${cleanFirst}.${cleanLast}${index}@${provider}`
}

function generatePhoneNumber(prefix: string): string {
  const randomNumber = Math.floor(Math.random() * 900000000) + 100000000
  return `${prefix}-${randomNumber}`
}

function generateAddress(cityData: typeof globalCities[0]): string {
  const streetNumber = Math.floor(Math.random() * 9999) + 1
  const streetNames = ['Main St', 'High St', 'Park Ave', 'Oak Ave', 'Market St', 'Cedar Rd', 'Pine St', 'Elm St', 'Maple Ave', 'Washington Blvd']
  const streetName = streetNames[Math.floor(Math.random() * streetNames.length)]
  return `${streetNumber} ${streetName}`
}

function generateZipCode(country: string): string {
  if (country === 'USA') {
    return String(Math.floor(Math.random() * 90000) + 10000)
  } else if (country === 'Canada') {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    return `${letters[Math.floor(Math.random() * 26)]}${Math.floor(Math.random() * 10)}${letters[Math.floor(Math.random() * 26)]} ${Math.floor(Math.random() * 10)}${letters[Math.floor(Math.random() * 26)]}${Math.floor(Math.random() * 10)}`
  } else {
    return String(Math.floor(Math.random() * 90000) + 10000)
  }
}

function generateRandomDate(startDate: Date, endDate: Date): Date {
  return new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()))
}

async function main() {
  console.log('🌍 Starting global customer generation...')
  console.log('📊 Target: 2000 customers across the globe')

  try {
    const startDate = new Date('2020-01-01')
    const endDate = new Date('2024-11-01')
    
    const customers = []
    
    for (let i = 0; i < 2000; i++) {
      const cityData = globalCities[Math.floor(Math.random() * globalCities.length)]
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
      const email = generateEmail(firstName, lastName, i + 1)
      
      // Add some variation to coordinates (±0.1 degrees)
      const lat = cityData.lat + (Math.random() * 0.2 - 0.1)
      const lon = cityData.lon + (Math.random() * 0.2 - 0.1)
      
      const customer = {
        firstName,
        lastName,
        email,
        phone: generatePhoneNumber(cityData.phone),
        address: generateAddress(cityData),
        city: cityData.city,
        state: cityData.state,
        country: cityData.country,
        zipCode: generateZipCode(cityData.country),
        latitude: lat,
        longitude: lon,
        dateJoined: generateRandomDate(startDate, endDate),
        totalSpent: Math.random() * 10000, // Random spending between $0-$10,000
      }
      
      customers.push(customer)
      
      if ((i + 1) % 100 === 0) {
        console.log(`📈 Progress: ${i + 1}/2000 customers generated`)
      }
    }
    
    console.log('💾 Inserting customers into database...')
    
    // Insert in batches of 100 for better performance
    for (let i = 0; i < customers.length; i += 100) {
      const batch = customers.slice(i, i + 100)
      await prisma.salesCustomer.createMany({
        data: batch,
        skipDuplicates: true,
      })
      console.log(`✅ Inserted batch ${Math.floor(i / 100) + 1}/${Math.ceil(customers.length / 100)}`)
    }
    
    console.log('🎉 Successfully created 2000 global customers!')
    console.log('\n📊 Geographic Distribution:')
    
    // Count customers by country
    const countryCount: { [key: string]: number } = {}
    customers.forEach(c => {
      countryCount[c.country] = (countryCount[c.country] || 0) + 1
    })
    
    const sortedCountries = Object.entries(countryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
    
    console.log('\nTop 10 Countries by Customer Count:')
    sortedCountries.forEach(([country, count]) => {
      console.log(`  ${country}: ${count} customers`)
    })
    
    // Calculate stats
    const avgSpent = customers.reduce((sum, c) => sum + c.totalSpent, 0) / customers.length
    const totalSpent = customers.reduce((sum, c) => sum + c.totalSpent, 0)
    
    console.log('\n💰 Financial Summary:')
    console.log(`  Total Revenue: $${totalSpent.toFixed(2)}`)
    console.log(`  Average per Customer: $${avgSpent.toFixed(2)}`)
    
  } catch (error) {
    console.error('❌ Error during customer generation:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
