
/**
 * User Salt API
 * Returns the salt used for key derivation
 * 
 * Note: Salt is NOT secret - it's okay to send over HTTPS
 * The derived key never leaves the client
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session: any = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get user's salt from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        id: true,
        encryptionSalt: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Return the user's unique encryption salt
    // Note: Salt is NOT secret - it's okay to send over HTTPS
    const salt = user.encryptionSalt || generateDeterministicSalt(user.id)

    return NextResponse.json({ salt })

  } catch (error) {
    console.error('Salt retrieval error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve salt' },
      { status: 500 }
    )
  }
}

/**
 * Fallback: generate deterministic salt for existing users without a salt
 * This maintains backward compatibility with users created before salt implementation
 */
function generateDeterministicSalt(userId: string): string {
  const crypto = require('crypto')
  const hash = crypto.createHash('sha256').update(userId + 'picard-ai-salt').digest('hex')
  return hash.substring(0, 64) // 32 bytes = 64 hex chars
}
