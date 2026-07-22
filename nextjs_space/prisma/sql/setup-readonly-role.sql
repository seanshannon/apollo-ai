-- Restricted role for executing LLM-generated SQL
--
-- The application runs generated SELECT statements through a separate
-- connection (QUERY_DATABASE_URL, see lib/query-db.ts). That connection
-- should authenticate as this role, which can read ONLY the demo dataset
-- tables. Application tables (User, organizations, audit_logs,
-- zk_database_connections, QueryHistory, ...) are not granted, so even a
-- validator bypass cannot read credentials, password hashes, or other
-- tenants' metadata.
--
-- Usage (as a superuser / database owner):
--   psql "$DATABASE_URL" -v ROLE_PASSWORD="'<strong password>'" -f prisma/sql/setup-readonly-role.sql
-- Then set in the app environment:
--   QUERY_DATABASE_URL=postgresql://apollo_query_readonly:<password>@<host>:<port>/<db>

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'apollo_query_readonly') THEN
    CREATE ROLE apollo_query_readonly LOGIN;
  END IF;
END
$$;

ALTER ROLE apollo_query_readonly WITH PASSWORD :'ROLE_PASSWORD';

-- Hard defaults for the role: read-only, bounded, no fancy state
ALTER ROLE apollo_query_readonly SET default_transaction_read_only = on;
ALTER ROLE apollo_query_readonly SET statement_timeout = '15s';

SELECT current_database() AS dbname \gset
GRANT CONNECT ON DATABASE :"dbname" TO apollo_query_readonly;
GRANT USAGE ON SCHEMA public TO apollo_query_readonly;

-- Start from zero: no blanket grants, no default privileges
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM apollo_query_readonly;

-- Demo dataset tables ONLY
GRANT SELECT ON
  sales_customers,
  sales_companies,
  sales_products,
  sales_orders,
  sales_order_items,
  hr_departments,
  hr_employees,
  hr_performance,
  inv_warehouses,
  inv_suppliers,
  inv_products,
  inv_inventory,
  fin_accounts,
  fin_transactions,
  fin_budgets,
  cust_customers,
  cust_tickets,
  cust_interactions
TO apollo_query_readonly;
