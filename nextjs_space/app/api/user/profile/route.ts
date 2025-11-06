
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { firstName, lastName, companyName, jobTitle } = body;

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(companyName !== undefined && { companyName }),
        ...(jobTitle !== undefined && { jobTitle }),
        ...(firstName || lastName ? { 
          name: `${firstName || session.user.firstName || ''} ${lastName || session.user.lastName || ''}`.trim() 
        } : {}),
      },
    });

    // Create audit log
    await createAuditLog({
      userId: session.user.id,
      action: 'USER_UPDATE',
      details: { 
        updatedFields: Object.keys(body),
        firstName,
        lastName,
        companyName,
        jobTitle
      },
      success: true,
    }).catch(err => console.error('Audit log error:', err));

    return NextResponse.json({ 
      success: true, 
      user: {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        name: updatedUser.name,
        email: updatedUser.email,
        companyName: updatedUser.companyName,
        jobTitle: updatedUser.jobTitle,
        image: updatedUser.image,
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
