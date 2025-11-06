
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        language: true,
        timezone: true,
        emailNotifications: true,
        queryAlerts: true,
        weeklyReport: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      preferences: user
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

async function updatePreferences(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { language, timezone, emailNotifications, queryAlerts, weeklyReport } = body;

    // Update user preferences in database
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(language !== undefined && { language }),
        ...(timezone !== undefined && { timezone }),
        ...(emailNotifications !== undefined && { emailNotifications }),
        ...(queryAlerts !== undefined && { queryAlerts }),
        ...(weeklyReport !== undefined && { weeklyReport }),
      },
    });

    // Create audit log
    await createAuditLog({
      userId: session.user.id,
      action: 'USER_UPDATE',
      details: { 
        action: 'update_preferences',
        preferences: body
      },
      success: true,
    }).catch(err => console.error('Audit log error:', err));

    return NextResponse.json({ 
      success: true,
      message: 'Preferences updated successfully',
      preferences: {
        language: updatedUser.language,
        timezone: updatedUser.timezone,
        emailNotifications: updatedUser.emailNotifications,
        queryAlerts: updatedUser.queryAlerts,
        weeklyReport: updatedUser.weeklyReport,
      }
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  return updatePreferences(req);
}

export async function PUT(req: NextRequest) {
  return updatePreferences(req);
}
