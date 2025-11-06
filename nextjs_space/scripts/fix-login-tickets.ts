import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixLoginTickets() {
  console.log('Updating login-related tickets with Next Steps...');
  
  // Find all tickets with "login" in subject (case insensitive)
  const loginTickets = await prisma.custTicket.findMany({
    where: {
      OR: [
        { subject: { contains: 'login', mode: 'insensitive' } },
        { subject: { contains: 'locked', mode: 'insensitive' } },
        { subject: { contains: 'password', mode: 'insensitive' } },
        { subject: { contains: 'access', mode: 'insensitive' } }
      ]
    }
  });

  console.log(`Found ${loginTickets.length} login-related tickets to update`);

  for (const ticket of loginTickets) {
    let nextSteps = '';
    
    // Determine next steps based on the issue type
    if (ticket.subject.toLowerCase().includes('locked') || ticket.subject.toLowerCase().includes('lock')) {
      nextSteps = '[NEXT_STEPS]: Verify user identity, then unlock account in admin panel > Users > Unlock Account. Reset failed login attempt counter.';
    } else if (ticket.subject.toLowerCase().includes('password') && ticket.subject.toLowerCase().includes('expired')) {
      nextSteps = '[NEXT_STEPS]: Send password reset email to user. Guide them through password reset process. Ensure new password meets complexity requirements.';
    } else if (ticket.subject.toLowerCase().includes('password') && ticket.subject.toLowerCase().includes('forgot')) {
      nextSteps = '[NEXT_STEPS]: Verify user email and send secure password reset link. Link should expire in 24 hours for security.';
    } else if (ticket.subject.toLowerCase().includes('mfa') || ticket.subject.toLowerCase().includes('2fa') || ticket.subject.toLowerCase().includes('two-factor')) {
      nextSteps = '[NEXT_STEPS]: Verify user identity using backup authentication method. Reset MFA device in admin panel > Users > MFA Settings. Send new setup instructions.';
    } else if (ticket.subject.toLowerCase().includes('verification') || ticket.subject.toLowerCase().includes('verify')) {
      nextSteps = '[NEXT_STEPS]: Resend verification email. Check spam folder. Verify email address is correct in system. Manually verify account if needed.';
    } else if (ticket.subject.toLowerCase().includes('suspended') || ticket.subject.toLowerCase().includes('disabled')) {
      nextSteps = '[NEXT_STEPS]: Review account suspension reason. If suspension was in error, reactivate account immediately. Notify user of reactivation.';
    } else if (ticket.subject.toLowerCase().includes('credentials') || ticket.subject.toLowerCase().includes('incorrect')) {
      nextSteps = '[NEXT_STEPS]: Verify username is correct. Send password reset link. Check for typos in email/username. Confirm account exists in system.';
    } else {
      // Generic login issue
      nextSteps = '[NEXT_STEPS]: Check user account status and verify credentials. Review recent login attempts and error logs. Reset password if needed. Contact user to confirm issue is resolved.';
    }
    
    // Update the ticket description to include next steps
    const updatedDescription = ticket.description.includes('[NEXT_STEPS]') 
      ? ticket.description  // Already has next steps
      : `${ticket.description}\n\n${nextSteps}`;
    
    await prisma.custTicket.update({
      where: { id: ticket.id },
      data: { description: updatedDescription }
    });
    
    console.log(`✓ Updated ticket: ${ticket.subject}`);
  }

  console.log('\nDone! All login-related tickets now have Next Steps.');
  await prisma.$disconnect();
}

fixLoginTickets().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
