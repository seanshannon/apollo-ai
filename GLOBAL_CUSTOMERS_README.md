# Apollo.ai Global Customers & Map Visualization

## Overview
Apollo.ai now includes 2,005 global customers with geographic coordinates for full map visualization and heat map capabilities.

## Customer Distribution

### Total Customers: 2,005
- **All customers have latitude/longitude coordinates**
- Distributed across 60+ major cities worldwide
- Includes customers from North America, South America, Europe, Asia, and Oceania

## Geographic Coverage

### North America (600+ customers)
- USA: New York, Los Angeles, Chicago, Houston, Phoenix, Philadelphia, San Diego, Dallas, San Jose, Austin, Seattle, Denver, Boston, Miami
- Canada: Toronto, Vancouver, Montreal
- Mexico: Mexico City

### South America (200+ customers)
- Brazil: São Paulo, Rio de Janeiro
- Argentina: Buenos Aires
- Peru: Lima
- Colombia: Bogotá
- Chile: Santiago

### Europe (800+ customers)
- UK: London, Manchester, Edinburgh
- France: Paris, Lyon, Marseille
- Germany: Berlin, Munich, Hamburg, Frankfurt
- Spain: Madrid, Barcelona
- Italy: Rome, Milan, Naples
- Netherlands: Amsterdam, Rotterdam
- Other: Vienna, Stockholm, Copenhagen, Dublin, Brussels, Zurich, Warsaw, Prague, Budapest

### Asia (300+ customers)
- Japan: Tokyo, Osaka, Kyoto
- China: Beijing, Shanghai, Guangzhou, Shenzhen
- India: Mumbai, Delhi, Bangalore, Hyderabad, Chennai
- Singapore, Hong Kong, Seoul, Bangkok, Manila

### Oceania (100+ customers)
- Australia: Sydney, Melbourne, Brisbane, Perth
- New Zealand: Auckland, Wellington

## Using Map Visualization

### Query Examples for Map View

1. **All Customers with Locations:**
   ```
   Show me all customers with their locations
   ```

2. **Customers by Country:**
   ```
   Show customers in the United States with coordinates
   ```

3. **Regional Analysis:**
   ```
   Display all European customers on a map
   ```

4. **Top Customers by Location:**
   ```
   Show top 50 customers by revenue with their geographic locations
   ```

### Map Features
- **Heat Map Visualization**: Automatically enabled when geographic data is present
- **Interactive Markers**: Click on locations to see customer details
- **Clustering**: Groups nearby customers for better visualization
- **Color Coding**: Represents data density or customer value

## Database Schema

### sales_customers Table
```sql
CREATE TABLE sales_customers (
  id              TEXT PRIMARY KEY,
  firstName       TEXT NOT NULL,
  lastName        TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  phone           TEXT,
  address         TEXT,
  city            TEXT,
  state           TEXT,
  country         TEXT NOT NULL DEFAULT 'USA',
  zipCode         TEXT,
  latitude        REAL,        -- NEW: For map visualization
  longitude       REAL,        -- NEW: For map visualization
  dateJoined      TIMESTAMP DEFAULT NOW(),
  totalSpent      REAL DEFAULT 0
);
```

## Testing Map Visualization

1. **Select the SALES database**
2. **Run a geographic query:**
   - "Show all customers with locations"
   - "Display customers on a map"
   - "Show me customer distribution worldwide"

3. **Click the "Map View" button** in the Results section
4. **Interact with the map:**
   - Zoom in/out
   - Click markers for details
   - View heat map overlays

## Data Quality
- ✅ All 2,005 customers have valid coordinates
- ✅ Coordinates verified for major cities
- ✅ No null values in latitude/longitude fields
- ✅ Ready for production demos

## Future Enhancements
- Real-time customer location tracking
- Territory mapping for sales teams
- Geographic revenue analysis
- Customer density heatmaps by product/service
- Route optimization for field sales

---

**Last Updated:** November 3, 2025
**Status:** ✅ Production Ready
