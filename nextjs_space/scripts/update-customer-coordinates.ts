import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Global cities with coordinates (matching what we already have)
const globalCities = [
  // North America
  { city: 'New York', state: 'NY', country: 'USA', lat: 40.7128, lon: -74.0060 },
  { city: 'Los Angeles', state: 'CA', country: 'USA', lat: 34.0522, lon: -118.2437 },
  { city: 'Chicago', state: 'IL', country: 'USA', lat: 41.8781, lon: -87.6298 },
  { city: 'Houston', state: 'TX', country: 'USA', lat: 29.7604, lon: -95.3698 },
  { city: 'Phoenix', state: 'AZ', country: 'USA', lat: 33.4484, lon: -112.0740 },
  { city: 'Toronto', state: 'ON', country: 'Canada', lat: 43.6532, lon: -79.3832 },
  { city: 'London', state: 'ENG', country: 'United Kingdom', lat: 51.5074, lon: -0.1278 },
  { city: 'Paris', state: 'IDF', country: 'France', lat: 48.8566, lon: 2.3522 },
  { city: 'Berlin', state: 'BE', country: 'Germany', lat: 52.5200, lon: 13.4050 },
  { city: 'Tokyo', state: 'TKY', country: 'Japan', lat: 35.6762, lon: 139.6503 },
  { city: 'Sydney', state: 'NSW', country: 'Australia', lat: -33.8688, lon: 151.2093 },
  { city: 'Singapore', state: 'SGP', country: 'Singapore', lat: 1.3521, lon: 103.8198 },
];

async function updateCoordinates() {
  console.log('Updating customer coordinates...');
  
  // Update customers with null coordinates
  const customersWithoutCoords = await prisma.salesCustomer.findMany({
    where: {
      OR: [
        { latitude: null },
        { longitude: null }
      ]
    }
  });
  
  console.log(`Found ${customersWithoutCoords.length} customers without coordinates`);
  
  for (const customer of customersWithoutCoords) {
    const cityMatch = globalCities.find(c => 
      c.city.toLowerCase() === customer.city?.toLowerCase() ||
      c.state.toLowerCase() === customer.state?.toLowerCase()
    );
    
    if (cityMatch) {
      await prisma.salesCustomer.update({
        where: { id: customer.id },
        data: {
          latitude: cityMatch.lat,
          longitude: cityMatch.lon
        }
      });
      console.log(`Updated ${customer.firstName} ${customer.lastName} in ${customer.city}`);
    }
  }
  
  const totalWithCoords = await prisma.salesCustomer.count({
    where: {
      AND: [
        { latitude: { not: null } },
        { longitude: { not: null } }
      ]
    }
  });
  
  console.log(`\nTotal customers with coordinates: ${totalWithCoords}`);
}

updateCoordinates()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
