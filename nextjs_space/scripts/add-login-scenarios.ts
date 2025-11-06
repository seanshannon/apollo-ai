import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get some customers to create realistic scenarios
  const customers = await prisma.custCustomer.findMany({ take: 10 });
  
  if (customers.length === 0) {
    console.log('No customers found. Please seed customers first.');
    return;
  }

  const loginScenarios = [
    {
      subject: 'Cannot log in - Password Expired',
      description: 'User John Smith (john.smith@company.com) cannot log in. Investigation shows password expired on 2025-10-28. Account is active but requires password reset.',
      status: 'OPEN',
      priority: 'HIGH',
      category: 'Login Issues',
      resolution: 'Password expired - requires reset',
      nextSteps: 'Reset password via admin portal or send password reset email to user'
    },
    {
      subject: 'Account Locked - Multiple Failed Login Attempts',
      description: 'Sarah Johnson (sarah.j@company.com) reports being locked out. System shows 5 failed login attempts in 10 minutes, triggering automatic account lock at 09:15 AM.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      category: 'Security',
      resolution: 'Account auto-locked due to failed attempts',
      nextSteps: 'Verify user identity, then unlock account in admin panel > Users > Unlock Account'
    },
    {
      subject: 'Login Failure - Account Suspended',
      description: 'Michael Chen (m.chen@company.com) cannot access system. Account shows SUSPENDED status due to payment failure on 2025-10-30. Subscription expired.',
      status: 'OPEN',
      priority: 'MEDIUM',
      category: 'Account Issues',
      resolution: 'Account suspended - payment required',
      nextSteps: 'Contact billing to resolve payment issue, then reactivate account in admin panel'
    },
    {
      subject: 'Cannot Login - Email Not Verified',
      description: 'New user Emma Davis (emma.d@company.com) created account yesterday but cannot log in. Email verification link not clicked. Account status: PENDING_VERIFICATION.',
      status: 'OPEN',
      priority: 'LOW',
      category: 'Account Setup',
      resolution: 'Email verification required',
      nextSteps: 'Resend verification email or manually verify account in admin panel > Users > Verify Email'
    },
    {
      subject: 'Login Issue - Account Deactivated by Admin',
      description: 'Robert Williams (r.williams@company.com) cannot log in. Account was deactivated by admin on 2025-10-25 due to company offboarding. Status: DEACTIVATED.',
      status: 'RESOLVED',
      priority: 'LOW',
      category: 'Access Management',
      resolution: 'Account intentionally deactivated',
      nextSteps: 'If reactivation needed, go to admin panel > Users > Reactivate Account'
    },
    {
      subject: 'Cannot Access System - IP Blocked',
      description: 'Linda Martinez (linda.m@company.com) cannot log in from new location. IP address 203.45.67.89 is not in whitelist. Geographic location: Malaysia.',
      status: 'OPEN',
      priority: 'MEDIUM',
      category: 'Security',
      resolution: 'IP address not whitelisted',
      nextSteps: 'Verify legitimate access attempt, then add IP to whitelist in Security Settings > IP Whitelist'
    },
    {
      subject: 'Login Problems - Two-Factor Authentication Lost',
      description: 'David Brown (david.b@company.com) cannot complete login. 2FA device lost. Unable to receive verification codes. Backup codes not saved.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      category: 'Security',
      resolution: '2FA device unavailable',
      nextSteps: 'Verify identity via alternative method, then disable 2FA temporarily in admin panel > Users > Manage 2FA'
    },
    {
      subject: 'Cannot Login - Session Expired',
      description: 'Jessica Taylor (jessica.t@company.com) keeps getting logged out. Session timeout set to 15 minutes. User inactive during long meetings.',
      status: 'RESOLVED',
      priority: 'LOW',
      category: 'Configuration',
      resolution: 'Session timeout as configured',
      nextSteps: 'Increase session timeout in Settings > Security > Session Management or advise user to use "Remember Me"'
    },
    {
      subject: 'Login Error - Incorrect Email Format',
      description: 'User attempting to log in with "james.wilson @ company .com" (spaces in email). System rejecting due to format validation.',
      status: 'RESOLVED',
      priority: 'LOW',
      category: 'User Error',
      resolution: 'Email format invalid',
      nextSteps: 'User education - ensure no spaces in email address when logging in'
    },
    {
      subject: 'Access Denied - Role Permissions Changed',
      description: 'Amanda White (amanda.w@company.com) can log in but sees "Access Denied" on dashboard. Role changed from ADMIN to USER on 2025-10-29.',
      status: 'OPEN',
      priority: 'MEDIUM',
      category: 'Permissions',
      resolution: 'Insufficient permissions for requested resource',
      nextSteps: 'Review role assignment in admin panel > Users > Edit Roles or restore previous permissions'
    }
  ];

  console.log('Creating detailed login scenario tickets...\n');

  for (let i = 0; i < loginScenarios.length; i++) {
    const scenario = loginScenarios[i];
    const customer = customers[i % customers.length];
    
    // Generate unique ticket number
    const ticketNumber = `TKT-LOGIN-${Date.now()}-${i}`;

    // Store next steps in the description with a special format
    const enhancedDescription = `${scenario.description}\n\n[NEXT_STEPS]: ${scenario.nextSteps}`;
    
    const ticket = await prisma.custTicket.create({
      data: {
        ticketNumber,
        subject: scenario.subject,
        description: enhancedDescription,
        status: scenario.status as any,
        priority: scenario.priority as any,
        category: scenario.category,
        customerId: customer.id,
        resolution: scenario.resolution
      }
    });

    console.log(`✅ Created: ${scenario.subject}`);
  }

  console.log(`\n✨ Successfully created ${loginScenarios.length} login scenario tickets!`);
  
  // Show a sample query
  console.log('\n📝 Example queries you can try:');
  console.log('  - "Why can\'t users log in?"');
  console.log('  - "Show me login issues this month"');
  console.log('  - "What password problems do we have?"');
  console.log('  - "Show account suspension cases"');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
