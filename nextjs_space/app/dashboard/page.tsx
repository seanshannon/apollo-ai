
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { DashboardClient } from './dashboard-client'

export default async function Dashboard() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/')
  }

  // Fetch profile image separately from database (not stored in JWT to prevent "Request Header Fields Too Large")
  let profileImage = null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { image: true }
    });
    profileImage = user?.image || null;
  } catch (error) {
    console.error('Error fetching profile image:', error);
  }

  return (
    <div>
      <DashboardClient 
        user={{
          ...session.user,
          image: profileImage
        }} 
      />
    </div>
  )
}
