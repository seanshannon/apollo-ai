
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

const prisma = new PrismaClient();

async function migrateToMultiTenant() {
  console.log('🚀 Starting multi-tenant migration...\n');

  try {
    // Step 1: Add organizationId columns as optional
    console.log('Step 1: Adding organizationId columns as nullable...');
    await prisma.$executeRaw`
      ALTER TABLE "QueryHistory" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
    `;
    await prisma.$executeRaw`
      ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
    `;
    await prisma.$executeRaw`
      ALTER TABLE "zk_database_connections" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
    `;
    await prisma.$executeRaw`
      ALTER TABLE "zk_database_connections" ADD COLUMN IF NOT EXISTS "schemaCache" TEXT;
    `;
    await prisma.$executeRaw`
      ALTER TABLE "zk_database_connections" ADD COLUMN IF NOT EXISTS "lastSchemaSync" TIMESTAMP;
    `;
    await prisma.$executeRaw`
      ALTER TABLE "zk_database_connections" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;
    `;
    console.log('✅ Columns added\n');

    // Step 2: Create Organization and OrganizationMember tables
    console.log('Step 2: Creating multi-tenant tables...');
    
    // Create OrgRole enum
    await prisma.$executeRaw`
      DO $$ BEGIN
        CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;

    // Create organizations table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "organizations" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "slug" TEXT NOT NULL UNIQUE,
        "ownerId" TEXT NOT NULL,
        "plan" TEXT NOT NULL DEFAULT 'free',
        "status" TEXT NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "organizations_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );
    `;

    // Create organization_members table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "organization_members" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "organizationId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
        "invitedBy" TEXT,
        "joinedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        UNIQUE ("organizationId", "userId")
      );
    `;

    // Create indexes
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "organizations_ownerId_idx" ON "organizations"("ownerId");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "organization_members_userId_idx" ON "organization_members"("userId");`;
    
    console.log('✅ Multi-tenant tables created\n');

    // Step 3: Get all users and create organizations for them
    console.log('Step 3: Creating organizations for existing users...');
    const users = await prisma.user.findMany();
    
    for (const user of users) {
      const orgId = `org_${user.id}_default`;
      const slug = `${user.email?.split('@')[0] || 'user'}-${user.id.slice(0, 8)}`.toLowerCase();
      
      // Create organization
      await prisma.$executeRaw`
        INSERT INTO "organizations" ("id", "name", "slug", "ownerId", "plan", "status", "createdAt", "updatedAt")
        VALUES (${orgId}, ${user.firstName || user.name || 'My Organization'}, ${slug}, ${user.id}, 'free', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("slug") DO NOTHING;
      `;
      
      // Add user as owner member
      await prisma.$executeRaw`
        INSERT INTO "organization_members" ("id", "organizationId", "userId", "role", "joinedAt")
        VALUES (${`mem_${orgId}`}, ${orgId}, ${user.id}, 'OWNER'::"OrgRole", CURRENT_TIMESTAMP)
        ON CONFLICT ("organizationId", "userId") DO NOTHING;
      `;
      
      // Update all their records with organizationId
      await prisma.$executeRaw`
        UPDATE "QueryHistory" SET "organizationId" = ${orgId} WHERE "userId" = ${user.id} AND "organizationId" IS NULL;
      `;
      await prisma.$executeRaw`
        UPDATE "audit_logs" SET "organizationId" = ${orgId} WHERE "userId" = ${user.id} AND "organizationId" IS NULL;
      `;
      await prisma.$executeRaw`
        UPDATE "zk_database_connections" SET "organizationId" = ${orgId} WHERE "userId" = ${user.id} AND "organizationId" IS NULL;
      `;
      
      console.log(`✅ Created organization for user: ${user.email}`);
    }
    
    console.log('\n✅ Organizations created for all users\n');

    // Step 4: Make organizationId NOT NULL
    console.log('Step 4: Making organizationId columns required...');
    await prisma.$executeRaw`
      ALTER TABLE "QueryHistory" ALTER COLUMN "organizationId" SET NOT NULL;
    `;
    await prisma.$executeRaw`
      ALTER TABLE "audit_logs" ALTER COLUMN "organizationId" SET NOT NULL;
    `;
    await prisma.$executeRaw`
      ALTER TABLE "zk_database_connections" ALTER COLUMN "organizationId" SET NOT NULL;
    `;
    console.log('✅ Columns made required\n');

    // Step 5: Add foreign key constraints
    console.log('Step 5: Adding foreign key constraints...');
    
    // Check and add FK for QueryHistory
    await prisma.$executeRaw`
      DO $$ BEGIN
        ALTER TABLE "QueryHistory" 
        ADD CONSTRAINT "QueryHistory_organizationId_fkey" 
        FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    
    // Check and add FK for audit_logs
    await prisma.$executeRaw`
      DO $$ BEGIN
        ALTER TABLE "audit_logs" 
        ADD CONSTRAINT "audit_logs_organizationId_fkey" 
        FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    
    // Check and add FK for zk_database_connections
    await prisma.$executeRaw`
      DO $$ BEGIN
        ALTER TABLE "zk_database_connections" 
        ADD CONSTRAINT "zk_database_connections_organizationId_fkey" 
        FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    console.log('✅ Foreign keys added\n');

    // Step 6: Create indexes
    console.log('Step 6: Creating indexes...');
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "QueryHistory_organizationId_idx" ON "QueryHistory"("organizationId");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "zk_database_connections_organizationId_idx" ON "zk_database_connections"("organizationId");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "audit_logs_organizationId_timestamp_idx" ON "audit_logs"("organizationId", "timestamp");`;
    console.log('✅ Indexes created\n');

    console.log('🎉 Multi-tenant migration completed successfully!');
    console.log(`\nSummary:`);
    console.log(`- Created ${users.length} organizations`);
    console.log(`- All existing data has been linked to respective organizations`);
    console.log(`- System is now multi-tenant ready!\n`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateToMultiTenant();
