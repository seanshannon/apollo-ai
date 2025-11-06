
# Apollo.ai Advanced Features Documentation

This document details the advanced features that have been implemented in the Apollo.ai application, going beyond the core MVP functionality.

## Table of Contents

1. [Schema Discovery](#schema-discovery)
2. [Multi-Database Connections](#multi-database-connections)
3. [Query Explanation](#query-explanation)
4. [Deep Links & Query Sharing](#deep-links--query-sharing)
5. [Advanced Data Export](#advanced-data-export)
6. [Security & Audit Trail](#security--audit-trail)

---

## Schema Discovery

### Overview
The Schema Discovery feature allows users to dynamically explore database structures, including tables, columns, relationships, and row counts.

### API Endpoint
```
GET /api/schema-discovery?databaseId={databaseId}
```

### Response Format
```json
{
  "success": true,
  "database": "sales",
  "tables": [
    {
      "name": "sales_customers",
      "displayName": "Customers",
      "rowCount": 150,
      "description": "Customer information and contact details",
      "columns": [
        {
          "name": "id",
          "type": "string",
          "nullable": false,
          "isPrimaryKey": true,
          "isForeignKey": false
        },
        {
          "name": "email",
          "type": "string",
          "nullable": false,
          "isPrimaryKey": false,
          "isForeignKey": false,
          "description": "Customer email address"
        }
      ],
      "relationships": [
        {
          "fromTable": "sales_customers",
          "toTable": "sales_orders",
          "type": "one-to-many",
          "description": "A customer can have many orders"
        }
      ]
    }
  ]
}
```

### Features
- Dynamic table and column discovery
- Relationship mapping (one-to-many, many-to-one, etc.)
- Real-time row counts
- Column type information
- Primary key and foreign key identification

### Use Cases
- Data exploration for non-technical users
- Understanding database structure before querying
- Identifying available data sources
- Planning complex queries with joins

---

## Multi-Database Connections

### Overview
Allows users to configure and connect to multiple external databases beyond the built-in demo databases.

### Supported Database Types
- PostgreSQL
- MySQL
- SQLite
- MongoDB

### API Endpoints

#### List Connections
```
GET /api/database-connections
```

#### Add Connection
```
POST /api/database-connections
Body: {
  "name": "Production Database",
  "type": "postgresql",
  "host": "db.example.com",
  "port": 5432,
  "database": "production",
  "username": "app_user",
  "password": "secure_password",
  "ssl": true
}
```

#### Test Connection
```
POST /api/database-connections
Body: {
  "action": "test",
  "name": "Test Connection",
  "type": "postgresql",
  "host": "db.example.com",
  "port": 5432,
  "database": "test_db",
  "username": "test_user",
  "password": "test_pass",
  "ssl": true
}
```

#### Delete Connection
```
DELETE /api/database-connections?id={connectionId}
```

### Security Features
- Passwords encrypted at rest using AES-256-GCM
- Connection credentials never exposed in API responses
- SSL/TLS support for secure connections
- Connection testing before saving
- Audit logging for all connection operations

### Implementation Details
```typescript
// lib/database-connections.ts
export interface DatabaseConnection {
  id: string
  name: string
  type: 'postgresql' | 'mysql' | 'sqlite' | 'mongodb'
  host: string
  port: number
  database: string
  username: string
  password: string // Encrypted in storage
  ssl: boolean
  createdAt: Date
  updatedAt: Date
}
```

---

## Query Explanation

### Overview
Provides human-readable explanations of SQL queries, helping non-technical users understand what data is being retrieved and how.

### API Endpoint
```
POST /api/query-explain
Body: {
  "sql": "SELECT * FROM customers WHERE city = 'New York'",
  "databaseId": "sales",
  "naturalQuery": "Show me all customers in New York"
}
```

### Response Format
```json
{
  "success": true,
  "explanation": "This query retrieves all customer records from the customers table where the city column matches 'New York'. It will return all information about customers located in New York.",
  "technical_details": "The query performs a full table scan with a WHERE clause filter on the city column. If there's an index on the city column, performance will be optimal. Otherwise, it may scan all rows.",
  "tables_accessed": ["customers"],
  "performance_notes": "For optimal performance, ensure an index exists on the city column. Expected scan of ~100 rows out of 10,000 total.",
  "security_notes": "This query does not expose sensitive data beyond what the user is authorized to access. PII masking is applied automatically."
}
```

### Features
- Simple language explanations for non-technical users
- Technical details for power users
- Performance considerations
- Security notes
- Tables accessed information

### UI Integration
- "Explain" button in query results
- Modal dialog with structured explanation
- Collapsible sections for different detail levels

---

## Deep Links & Query Sharing

### Overview
Create shareable links to query results that can be accessed by anyone with the link, enabling collaboration and reporting.

### API Endpoints

#### Create Share Link
```
POST /api/share-query
Body: {
  "queryHistoryId": "query_id_here"
}
```

Response:
```json
{
  "success": true,
  "shareUrl": "https://apollo.ai/share/encrypted_token_here",
  "expiresIn": "7 days"
}
```

#### Access Shared Query
```
GET /api/share-query?token={encrypted_token}
```

### Share Link Format
```
https://your-domain.com/share/{encrypted_token}
```

### Features
- Encrypted share tokens
- 7-day expiration (configurable)
- Full query results accessible without login
- Shows query metadata (who shared, when, database)
- Export capabilities (CSV, JSON, PDF)
- Cannot be modified or re-executed

### Security Considerations
- Tokens are one-way encrypted with timestamp
- Expired links return 410 Gone status
- PII masking applied to shared data
- Original query creator identified in metadata
- All share actions logged in audit trail

### Share Page UI (`/share/[token]`)
- Clean, public-facing design
- Query details and metadata
- Results visualization
- Export options
- Attribution (shared by X)
- Link to main Apollo.ai app

### Implementation
```typescript
// Token structure (before encryption)
{
  queryId: "query_history_id",
  userId: "user_id",
  createdAt: "2024-01-15T10:30:00Z"
}

// Encrypted token is URL-safe base64
```

---

## Advanced Data Export

### Overview
Enhanced export capabilities with metadata and multiple formats.

### Supported Formats
1. **CSV** - Comma-separated values with metadata comments
2. **JSON** - Structured data with metadata object
3. **PDF** - Formatted document via browser print (HTML-based)

### Export Features

#### CSV Export
```csv
# Apollo.ai Data Export
# Query: Show me top customers by revenue
# Database: sales
# Export Date: 2024-01-15T10:30:00Z
# Row Count: 25
# Execution Time: 145ms

customer_name,total_spent,location,member_since
John Doe,15000,New York NY,2023-01-15
Jane Smith,12500,Los Angeles CA,2023-02-20
```

#### JSON Export
```json
{
  "metadata": {
    "source": "Apollo.ai",
    "query": "Show me top customers by revenue",
    "database": "sales",
    "exportDate": "2024-01-15T10:30:00Z",
    "rowCount": 25,
    "executionTime": 145
  },
  "data": [
    {
      "customer_name": "John Doe",
      "total_spent": 15000,
      "location": "New York, NY",
      "member_since": "2023-01-15"
    }
  ]
}
```

#### PDF Export
- Formatted table with headers
- Query metadata in header
- Apollo.ai branding
- Timestamp and row count
- Optimized for printing

### Export API
```typescript
// lib/data-export.ts
export interface ExportMetadata {
  query: string
  database: string
  exportDate: string
  rowCount: number
  executionTime?: number
}

exportToCSV(data: any[], filename: string, metadata?: ExportMetadata)
exportToJSON(data: any[], filename: string, metadata?: ExportMetadata)
exportToPDF(data: any[], filename: string, metadata?: ExportMetadata)
```

---

## Security & Audit Trail

### New Audit Actions
All advanced features are tracked in the audit log:

```typescript
export type AuditAction = 
  | 'QUERY_EXPLAIN'        // When user requests query explanation
  | 'QUERY_SHARE'          // When user creates share link
  | 'DB_CONNECTION_TEST'   // When user tests database connection
  | 'DB_CONNECTION_ADD'    // When user adds new connection
  | 'DB_CONNECTION_DELETE' // When user deletes connection
  | 'SCHEMA_DISCOVERY'     // When user explores database schema
  // ... existing actions
```

### Audit Log Entry Example
```json
{
  "id": "audit_log_id",
  "userId": "user_id",
  "action": "QUERY_SHARE",
  "resource": "query:query_id_here",
  "details": {
    "queryHistoryId": "query_id",
    "shareUrl": "https://app.com/share/token"
  },
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "success": true,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Security Measures

#### Encryption
- Database connection passwords: AES-256-GCM
- Share tokens: One-way encryption with timestamp
- Sensitive data at rest: Encrypted in database

#### Access Control
- Share links are public but time-limited
- Connection credentials never exposed in API
- PII automatically masked in shared queries

#### Audit Trail
- Complete logging of all actions
- Indexed by user, action, and timestamp
- IP address and user agent tracking
- Success/failure tracking
- Detailed error messages

---

## Usage Examples

### Example 1: Exploring Database Schema
```typescript
// Fetch schema information
const response = await fetch('/api/schema-discovery?databaseId=sales')
const { tables } = await response.json()

// Display table information
tables.forEach(table => {
  console.log(`${table.displayName} (${table.rowCount} rows)`)
  console.log('Columns:', table.columns.map(c => c.name).join(', '))
})
```

### Example 2: Connecting External Database
```typescript
// Add new database connection
const connection = await fetch('/api/database-connections', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Production Analytics',
    type: 'postgresql',
    host: 'analytics.example.com',
    port: 5432,
    database: 'analytics',
    username: 'readonly_user',
    password: 'secure_pass',
    ssl: true
  })
})

const result = await connection.json()
console.log('Connection added:', result.connection.id)
```

### Example 3: Sharing Query Results
```typescript
// Create share link for latest query
const shareResponse = await fetch('/api/share-query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    queryHistoryId: lastQueryId
  })
})

const { shareUrl } = await shareResponse.json()
console.log('Share this link:', shareUrl)
// https://apollo.ai/share/encrypted_token_here
```

### Example 4: Getting Query Explanation
```typescript
// Explain a SQL query
const explanation = await fetch('/api/query-explain', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sql: 'SELECT customer_name, SUM(total_amount) FROM orders GROUP BY customer_name',
    databaseId: 'sales',
    naturalQuery: 'Show me total spending by customer'
  })
})

const result = await explanation.json()
console.log('Simple explanation:', result.explanation)
console.log('Technical details:', result.technical_details)
```

---

## Future Enhancements

### Potential Additions
1. **Query Templates** - Save and reuse common query patterns
2. **Scheduled Reports** - Automatically run and share queries on schedule
3. **Data Alerts** - Notify when data meets certain conditions
4. **Advanced Visualizations** - More chart types and customization
5. **Query Optimization Suggestions** - AI-powered performance tips
6. **Multi-tenant Database Support** - Separate data per organization
7. **API Rate Limiting** - Per-user/per-endpoint rate limits
8. **Query Result Caching** - Cache frequently-run queries
9. **Real-time Collaboration** - Multiple users working on queries simultaneously
10. **Version Control for Connections** - Track changes to database configurations

---

## Testing

All advanced features include comprehensive test coverage:

```bash
# Run all tests
yarn test

# Test results
Test Suites: 4 passed, 4 total
Tests:       56 passed, 56 total
```

### MC/DC Coverage
Modified Condition/Decision Coverage ensures all code paths are tested:
- Authentication logic: 100% coverage
- Query validation: 100% coverage
- Security controls: 100% coverage
- API endpoints: Full integration tests

---

## API Reference Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/schema-discovery` | GET | Discover database schema |
| `/api/database-connections` | GET | List all connections |
| `/api/database-connections` | POST | Add/test connection |
| `/api/database-connections` | DELETE | Remove connection |
| `/api/query-explain` | POST | Get query explanation |
| `/api/share-query` | POST | Create share link |
| `/api/share-query` | GET | Retrieve shared query |
| `/share/[token]` | GET | Public share page |

---

## Conclusion

These advanced features transform Apollo.ai from a basic query interface into a comprehensive data intelligence platform suitable for enterprise use. The combination of user-friendly features (explanations, sharing) with powerful capabilities (multi-DB support, schema discovery) makes data accessible to non-technical users while maintaining enterprise-grade security and auditability.
