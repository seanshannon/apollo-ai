/**
 * Tests for the AST-based SQL validator that guards LLM-generated queries.
 *
 * Unlike the previous suites, these import and exercise the real module.
 * The corpus includes the bypass classes the old regex validator was
 * vulnerable to (CTE wrapping, UNION exfiltration, comment obfuscation,
 * scalar subqueries, dangerous scalar functions).
 */

import {
  validateGeneratedSQL,
  sanitizeSQLForLogging,
  DATABASE_TABLE_ALLOWLISTS,
} from '@/lib/sql-validator'

describe('validateGeneratedSQL', () => {
  describe('legitimate queries are allowed', () => {
    it('accepts a basic select on an allowed table', () => {
      const r = validateGeneratedSQL('SELECT "firstName", "lastName" FROM sales_customers LIMIT 5', 'sales')
      expect(r.valid).toBe(true)
      expect(r.tables).toEqual(['sales_customers'])
    })

    it('accepts joins between allowed tables', () => {
      const r = validateGeneratedSQL(
        'SELECT c."firstName", o."totalAmount" FROM sales_orders o JOIN sales_customers c ON o."customerId" = c.id',
        'sales'
      )
      expect(r.valid).toBe(true)
      expect(r.tables?.sort()).toEqual(['sales_customers', 'sales_orders'])
    })

    it('accepts CTEs over allowed tables', () => {
      const r = validateGeneratedSQL('WITH top AS (SELECT * FROM sales_orders) SELECT * FROM top', 'sales')
      expect(r.valid).toBe(true)
    })

    it('accepts UNION ALL of allowed tables', () => {
      const r = validateGeneratedSQL(
        'SELECT id FROM sales_customers UNION ALL SELECT id FROM sales_companies',
        'sales'
      )
      expect(r.valid).toBe(true)
    })

    it('accepts aggregates and GROUP BY', () => {
      const r = validateGeneratedSQL(
        'SELECT state, COUNT(*) AS n, AVG("totalSpent") FROM sales_customers GROUP BY state HAVING COUNT(*) > 1',
        'sales'
      )
      expect(r.valid).toBe(true)
    })

    it('accepts explicit public schema qualification', () => {
      const r = validateGeneratedSQL('SELECT * FROM public.sales_customers', 'sales')
      expect(r.valid).toBe(true)
    })

    it('accepts each demo database with its own tables', () => {
      for (const [db, tables] of Object.entries(DATABASE_TABLE_ALLOWLISTS)) {
        const r = validateGeneratedSQL(`SELECT * FROM ${tables[0]}`, db)
        expect(r.valid).toBe(true)
      }
    })
  })

  describe('write and DDL statements are rejected', () => {
    it.each([
      ['DELETE FROM sales_customers'],
      ["UPDATE sales_customers SET email = 'x'"],
      ["INSERT INTO sales_customers (id) VALUES ('x')"],
      ['DROP TABLE sales_customers'],
      ['TRUNCATE sales_customers'],
      ['CREATE TABLE evil (id int)'],
      ['ALTER TABLE sales_customers ADD COLUMN evil text'],
    ])('rejects %s', (sql) => {
      expect(validateGeneratedSQL(sql, 'sales').valid).toBe(false)
    })

    it('rejects multi-statement input', () => {
      const r = validateGeneratedSQL('SELECT * FROM sales_customers; DELETE FROM sales_customers', 'sales')
      expect(r.valid).toBe(false)
      expect(r.error).toMatch(/single statement/i)
    })
  })

  describe('table allowlist enforcement (the class the regex missed)', () => {
    it('rejects reads of the User table', () => {
      const r = validateGeneratedSQL('SELECT email, password FROM "User"', 'sales')
      expect(r.valid).toBe(false)
      expect(r.error).toMatch(/not accessible/)
    })

    it.each([['audit_logs'], ['organizations'], ['zk_database_connections'], ['QueryHistory']])(
      'rejects reads of app table %s',
      (table) => {
        expect(validateGeneratedSQL(`SELECT * FROM "${table}"`, 'sales').valid).toBe(false)
      }
    )

    it('rejects cross-database table access', () => {
      expect(validateGeneratedSQL('SELECT * FROM hr_employees', 'sales').valid).toBe(false)
      expect(validateGeneratedSQL('SELECT * FROM sales_customers', 'hr').valid).toBe(false)
    })

    it('rejects a CTE wrapping a forbidden table', () => {
      const r = validateGeneratedSQL('WITH x AS (SELECT * FROM "User") SELECT * FROM x', 'sales')
      expect(r.valid).toBe(false)
    })

    it('rejects UNION exfiltration of a forbidden table', () => {
      const r = validateGeneratedSQL(
        'SELECT email FROM sales_customers UNION ALL SELECT password FROM "User"',
        'sales'
      )
      expect(r.valid).toBe(false)
    })

    it('rejects scalar subqueries on forbidden tables', () => {
      const r = validateGeneratedSQL('SELECT (SELECT email FROM "User" LIMIT 1)', 'sales')
      expect(r.valid).toBe(false)
    })

    it('rejects forbidden tables hidden behind comments', () => {
      const r = validateGeneratedSQL('SELECT /* sneaky */ * FROM "User" -- comment', 'sales')
      expect(r.valid).toBe(false)
    })

    it('rejects joins that smuggle in a forbidden table', () => {
      const r = validateGeneratedSQL(
        'SELECT c.email, u.password FROM sales_customers c JOIN "User" u ON u.email = c.email',
        'sales'
      )
      expect(r.valid).toBe(false)
    })
  })

  describe('schema and catalog restrictions', () => {
    it.each([
      ['SELECT * FROM pg_catalog.pg_tables'],
      ['SELECT * FROM information_schema.tables'],
      ['SELECT * FROM information_schema.columns'],
    ])('rejects %s', (sql) => {
      expect(validateGeneratedSQL(sql, 'sales').valid).toBe(false)
    })
  })

  describe('dangerous functions are rejected', () => {
    it.each([
      ["SELECT pg_read_file('/etc/passwd')"],
      ['SELECT pg_sleep(60)'],
      ["SELECT current_setting('server_version')"],
      ["SELECT set_config('x', 'y', false)"],
      ["SELECT dblink('conn', 'select 1')"],
      ['SELECT version()'],
    ])('rejects %s', (sql) => {
      const r = validateGeneratedSQL(sql, 'sales')
      expect(r.valid).toBe(false)
      expect(r.error).toMatch(/not allowed/)
    })

    it('rejects dangerous functions nested inside allowed queries', () => {
      const r = validateGeneratedSQL(
        "SELECT \"firstName\", pg_read_file('/etc/passwd') FROM sales_customers",
        'sales'
      )
      expect(r.valid).toBe(false)
    })

    it('rejects bare pg_-prefixed catalog functions not on the denylist', () => {
      expect(validateGeneratedSQL('SELECT pg_stat_get_activity(NULL)', 'sales').valid).toBe(false)
      expect(validateGeneratedSQL('SELECT pg_ls_waldir()', 'sales').valid).toBe(false)
    })

    it('rejects schema-qualified functions outside public', () => {
      const r = validateGeneratedSQL('SELECT pg_catalog.current_database()', 'sales')
      expect(r.valid).toBe(false)
      expect(r.error).toMatch(/schema/i)
    })

    it('still allows ordinary aggregate/scalar functions', () => {
      expect(validateGeneratedSQL('SELECT COUNT(*), MAX("totalSpent") FROM sales_customers', 'sales').valid).toBe(true)
      expect(validateGeneratedSQL('SELECT UPPER("firstName") FROM sales_customers', 'sales').valid).toBe(true)
    })
  })

  describe('fail-closed behavior', () => {
    it('rejects empty input', () => {
      expect(validateGeneratedSQL('', 'sales').valid).toBe(false)
      expect(validateGeneratedSQL('   ', 'sales').valid).toBe(false)
    })

    it('rejects unparseable SQL', () => {
      expect(validateGeneratedSQL('SELECT FROM WHERE', 'sales').valid).toBe(false)
      expect(validateGeneratedSQL('not sql at all', 'sales').valid).toBe(false)
    })

    it('rejects unknown database ids', () => {
      const r = validateGeneratedSQL('SELECT 1', 'not_a_database')
      expect(r.valid).toBe(false)
      expect(r.error).toMatch(/Unknown database/)
    })

    it('rejects queries above the complexity cap', () => {
      const nested =
        'SELECT * FROM (SELECT * FROM (SELECT * FROM (SELECT * FROM (SELECT * FROM (SELECT * FROM sales_customers) a) b) c) d) e'
      const r = validateGeneratedSQL(nested, 'sales')
      expect(r.valid).toBe(false)
      expect(r.error).toMatch(/complex/i)
    })
  })
})

describe('sanitizeSQLForLogging', () => {
  it('strips string literals', () => {
    expect(sanitizeSQLForLogging("SELECT * FROM t WHERE email = 'a@b.com'")).not.toContain('a@b.com')
  })

  it('strips quoted identifiers and long numbers', () => {
    const out = sanitizeSQLForLogging('SELECT "secretCol" FROM t WHERE ssn = 123456789')
    expect(out).not.toContain('secretCol')
    expect(out).not.toContain('123456789')
  })
})
