
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { createAuditLog } from '@/lib/audit'

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || 'placeholder-google-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'placeholder-google-client-secret',
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        })

        if (!user || !user.password) {
          // Audit log for failed login (user not found) - non-blocking
          createAuditLog({
            userId: 'unknown',
            action: 'LOGIN',
            details: { email: credentials.email, reason: 'User not found' },
            success: false,
            errorMessage: 'User not found or no password set'
          }).catch(err => console.error('Audit log error:', err))
          
          return null
        }

        const passwordsMatch = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!passwordsMatch) {
          // Audit log for failed login (wrong password) - non-blocking
          createAuditLog({
            userId: user.id,
            action: 'LOGIN',
            details: { email: credentials.email, reason: 'Incorrect password' },
            success: false,
            errorMessage: 'Incorrect password'
          }).catch(err => console.error('Audit log error:', err))
          
          return null
        }

        // Audit log for successful login - non-blocking
        createAuditLog({
          userId: user.id,
          action: 'LOGIN',
          details: { email: credentials.email },
          success: true
        }).catch(err => console.error('Audit log error:', err))

        return {
          id: user.id,
          email: user.email,
          name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        }
      }
    })
  ],
  session: {
    strategy: 'jwt' as const,
    maxAge: 8 * 60 * 60, // 8 hours in seconds
    updateAge: 60 * 60,  // Update session every hour
  },
  jwt: {
    maxAge: 8 * 60 * 60, // 8 hours
  },
  callbacks: {
    async jwt({ token, user, account, profile, trigger }: any) {
      if (user) {
        token.role = user.role
        token.firstName = user.firstName
        token.lastName = user.lastName
        // REMOVED: token.image = user.image (prevents "Request Header Fields Too Large" error)
        token.companyName = user.companyName
        token.jobTitle = user.jobTitle
      }
      
      // Handle Google OAuth users
      if (account?.provider === 'google' && profile) {
        // Fetch the user from database to get their role
        const dbUser = await prisma.user.findUnique({
          where: { email: profile.email },
          include: {
            memberships: {
              include: {
                organization: true
              }
            }
          }
        })
        
        if (dbUser) {
          token.role = dbUser.role
          token.firstName = dbUser.firstName || profile.given_name
          token.lastName = dbUser.lastName || profile.family_name
          // REMOVED: token.image = dbUser.image || profile.picture (prevents "Request Header Fields Too Large" error)
          token.companyName = dbUser.companyName
          token.jobTitle = dbUser.jobTitle
          
          // Audit log for successful Google login - non-blocking
          createAuditLog({
            userId: dbUser.id,
            action: 'LOGIN',
            details: { email: profile.email, provider: 'google' },
            success: true
          }).catch(err => console.error('Audit log error:', err))
        }
      }
      
      // When session is updated (e.g., after profile edit), refresh user data from database
      if (trigger === 'update' && token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub }
        })
        
        if (dbUser) {
          token.role = dbUser.role
          token.firstName = dbUser.firstName
          token.lastName = dbUser.lastName
          // REMOVED: token.image = dbUser.image (prevents "Request Header Fields Too Large" error)
          token.companyName = dbUser.companyName
          token.jobTitle = dbUser.jobTitle
          token.name = dbUser.name
        }
      }
      
      return token
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = token.role as string || 'USER'
        session.user.firstName = token.firstName as string
        session.user.lastName = token.lastName as string
        // REMOVED: session.user.image = token.image (will fetch separately from DB)
        session.user.companyName = token.companyName as string
        session.user.jobTitle = token.jobTitle as string
        session.user.name = token.name as string
      }
      return session
    },
    async signIn({ account, profile, user }: any) {
      // For Google OAuth, ensure email is verified and setup user organization
      if (account?.provider === 'google') {
        if (profile?.email_verified !== true) {
          return false
        }
        
        try {
          // Wait a moment to ensure PrismaAdapter has created the user
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // Check if user exists in database (PrismaAdapter should have created it by now)
          let dbUser = await prisma.user.findUnique({
            where: { email: profile.email },
            include: {
              memberships: true,
              ownedOrgs: true
            }
          })
          
          // If user still doesn't exist, wait a bit longer and try again
          if (!dbUser) {
            await new Promise(resolve => setTimeout(resolve, 200))
            dbUser = await prisma.user.findUnique({
              where: { email: profile.email },
              include: {
                memberships: true,
                ownedOrgs: true
              }
            })
          }
          
          if (dbUser) {
            // Update user info from Google profile if needed
            const updates: any = {}
            if (!dbUser.firstName && profile.given_name) {
              updates.firstName = profile.given_name
            }
            if (!dbUser.lastName && profile.family_name) {
              updates.lastName = profile.family_name
            }
            if (!dbUser.name && profile.name) {
              updates.name = profile.name
            }
            if (!dbUser.image && profile.picture) {
              updates.image = profile.picture
            }
            
            if (Object.keys(updates).length > 0) {
              await prisma.user.update({
                where: { id: dbUser.id },
                data: updates
              })
            }
            
            // Check if user has an organization
            const hasOrganization = dbUser.memberships.length > 0 || dbUser.ownedOrgs.length > 0
            
            if (!hasOrganization) {
              // Create organization for user who doesn't have one
              const orgName = profile.name || profile.email.split('@')[0]
              const orgSlug = `${orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`
              
              const org = await prisma.organization.create({
                data: {
                  name: orgName,
                  slug: orgSlug,
                  ownerId: dbUser.id,
                  plan: 'free',
                  status: 'active',
                  members: {
                    create: {
                      userId: dbUser.id,
                      role: 'OWNER'
                    }
                  }
                }
              })
              
              console.log(`Created organization ${org.id} for Google SSO user ${dbUser.id}`)
              
              // Create audit log for new user signup - non-blocking
              createAuditLog({
                organizationId: org.id,
                userId: dbUser.id,
                action: 'USER_CREATE',
                details: { 
                  email: profile.email, 
                  provider: 'google',
                  name: profile.name
                },
                success: true
              }).catch(err => console.error('Audit log error:', err))
            }
          } else {
            console.error('User not found after Google SSO authentication:', profile.email)
            return false
          }
          
          return true
        } catch (error) {
          console.error('Error in Google SSO signIn callback:', error)
          return false
        }
      }
      return true
    }
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET,
  // Enable linking of Google accounts to existing email/password accounts
  // This allows users who signed up with email/password to also sign in with Google
  allowDangerousEmailAccountLinking: true,
}
