
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';

// GET /api/organizations - List user's organizations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        memberships: {
          include: {
            organization: {
              include: {
                _count: {
                  select: {
                    members: true,
                    dbConnections: true,
                  },
                },
              },
            },
          },
        },
        ownedOrgs: {
          include: {
            _count: {
              select: {
                members: true,
                dbConnections: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Combine owned and member organizations
    const organizations = [
      ...user.ownedOrgs.map((org: any) => ({
        ...org,
        role: 'OWNER' as const,
        memberCount: org._count.members,
        dbConnectionCount: org._count.dbConnections,
      })),
      ...user.memberships.map((membership: any) => ({
        ...membership.organization,
        role: membership.role,
        memberCount: membership.organization._count.members,
        dbConnectionCount: membership.organization._count.dbConnections,
      })),
    ];

    // Remove duplicates (user is both owner and member)
    const uniqueOrgs = Array.from(
      new Map(organizations.map((org) => [org.id, org])).values()
    );

    return NextResponse.json({ organizations: uniqueOrgs });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}

// POST /api/organizations - Create new organization
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      );
    }

    // Generate slug from name
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Ensure slug is unique
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create organization and add user as owner member
    const organization = await prisma.organization.create({
      data: {
        name: name.trim(),
        slug,
        ownerId: user.id,
        plan: 'free',
        status: 'active',
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
          },
        },
      },
      include: {
        members: true,
        _count: {
          select: {
            members: true,
            dbConnections: true,
          },
        },
      },
    });

    return NextResponse.json({ 
      organization: {
        ...organization,
        memberCount: organization._count.members,
        dbConnectionCount: organization._count.dbConnections,
      },
      message: 'Organization created successfully' 
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating organization:', error);
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}
