
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { sendWelcomeEmail } from '@/lib/email'

/**
 * Validates password meets security requirements
 */
function validatePasswordStrength(password: string): { 
  valid: boolean; 
  errors: string[] 
} {
  const errors: string[] = [];
  
  // Length requirement
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }
  
  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
  }
  
  // Complexity requirements
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z)');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z)');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number (0-9)');
  }
  
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*...)');
  }
  
  // Check against common passwords
  const commonPasswords = [
    'password', 'password123', '123456', '12345678', 'qwerty', 
    'abc123', 'monkey', '1234567', 'letmein', 'trustno1',
    'dragon', 'baseball', 'iloveyou', 'master', 'sunshine',
    'ashley', 'bailey', 'shadow', 'superman', 'qazwsx',
    'michael', 'football', 'welcome', 'jesus', 'ninja',
    'mustang', 'password1', 'admin', 'admin123', 'picard'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common. Please choose a more unique password');
  }
  
  // Check for sequential characters
  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password)) {
    errors.push('Password contains sequential characters');
  }
  
  // Check for repeated characters
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password contains too many repeated characters');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, firstName, lastName } = body

    // Get request metadata for audit logging
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      // Audit log for failed signup (user exists)
      await createAuditLog({
        userId: 'unknown',
        action: 'USER_CREATE',
        details: { email, reason: 'User already exists' },
        ipAddress,
        userAgent,
        success: false,
        errorMessage: 'User already exists'
      }).catch(err => console.error('Audit log error:', err))
      
      return NextResponse.json(
        { message: 'User already exists' },
        { status: 400 }
      )
    }

    // SECURITY: Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { 
          message: 'Password does not meet security requirements', 
          errors: passwordValidation.errors 
        },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12) // Increased to 12 rounds for better security

    // Generate unique salt for zero-knowledge encryption
    // This salt is NOT secret - it's used for key derivation
    const encryptionSalt = crypto.randomBytes(32).toString('hex')

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        encryptionSalt, // Store salt for key derivation
      },
    })

    // Create default organization for new user
    const slug = `${email.split('@')[0]}-${user.id.slice(0, 8)}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const organization = await prisma.organization.create({
      data: {
        name: `${firstName}'s Workspace`,
        slug,
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
          },
        },
      },
    })

    // Audit log for successful signup
    await createAuditLog({
      organizationId: organization.id,
      userId: user.id,
      action: 'USER_CREATE',
      details: { email, firstName, lastName },
      ipAddress,
      userAgent,
      success: true
    }).catch(err => console.error('Audit log error:', err))

    // Send welcome email
    const dashboardUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard`
    const emailResult = await sendWelcomeEmail({
      firstName,
      email,
      organizationName: organization.name,
      dashboardUrl,
    }).catch(err => {
      console.error('Error sending welcome email:', err)
      return { success: false, error: err }
    })

    return NextResponse.json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      emailSent: emailResult?.success || false,
      emailNote: !emailResult?.success 
        ? 'Welcome email could not be sent. This is normal with Resend\'s free tier - emails can only be sent to verified addresses. Your account is still active!' 
        : undefined
    })
  } catch (error) {
    console.error('Signup error:', error)
    
    // Audit log for signup error
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    
    await createAuditLog({
      userId: 'unknown',
      action: 'USER_CREATE',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
      ipAddress,
      userAgent,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Internal server error'
    }).catch(err => console.error('Audit log error:', err))
    
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
