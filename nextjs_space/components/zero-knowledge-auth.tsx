
'use client'

/**
 * Zero-Knowledge Authentication Component
 * 
 * Handles key derivation from password at login
 * Keys are stored only in memory, never persisted
 */

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  deriveKeyFromPassword,
  setSessionEncryptionKey,
  generateSalt,
  uint8ArrayToHex,
  hexToUint8Array
} from '@/lib/zero-knowledge-crypto'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, Lock, Shield } from 'lucide-react'

export function ZeroKnowledgeAuth() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Step 1: Authenticate with server (traditional auth)
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password
      })

      if (result?.error) {
        setError('Invalid credentials')
        setLoading(false)
        return
      }

      // Step 2: Fetch user's salt from server
      const saltResponse = await fetch('/api/user/salt')
      const { salt: saltHex } = await saltResponse.json()
      
      if (!saltHex) {
        throw new Error('Failed to retrieve encryption salt')
      }

      // Step 3: Derive encryption key from password (CLIENT-SIDE ONLY)
      const salt = hexToUint8Array(saltHex)
      const encryptionKey = await deriveKeyFromPassword(password, salt)

      // Step 4: Store key in memory (NEVER send to server)
      setSessionEncryptionKey(encryptionKey)

      // Step 5: Redirect to dashboard
      router.push('/dashboard')

    } catch (err) {
      console.error('Login error:', err)
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Zero-Knowledge Notice */}
      <Alert className="bg-terminal-green/10 border-2 border-terminal-green/20">
        <Shield className="h-4 w-4 text-terminal-green" />
        <AlertDescription className="text-sm text-terminal-green/90 font-share-tech">
          <strong className="font-orbitron">[ZERO-KNOWLEDGE SECURITY]:</strong> Your password derives an encryption key that exists only in your browser. 
          The server never has access to your sensitive data.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-terminal-green font-share-tech">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-black/60 border-terminal-green text-terminal-green placeholder:text-terminal-green/50 focus:shadow-terminal font-share-tech"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-terminal-green font-share-tech">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-black/60 border-terminal-green text-terminal-green placeholder:text-terminal-green/50 focus:shadow-terminal font-share-tech"
          />
          <p className="text-xs text-terminal-green/70 font-share-tech">
            <Lock className="inline h-3 w-3 mr-1" />
            Your password is used to derive an encryption key. It never leaves your device.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="bg-red-900/20 border-red-500 text-red-500">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          className="w-full bg-terminal-green hover:bg-terminal-green/80 text-black font-bold font-orbitron tracking-wider shadow-terminal hover:shadow-terminal-lg transition-all"
          disabled={loading}
        >
          {loading ? 'Deriving Encryption Key...' : 'Login'}
        </Button>
      </form>

      <div className="text-xs text-gray-400 space-y-2">
        <p className="flex items-start gap-2">
          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>
            If you forget your password, encrypted data cannot be recovered. 
            This is an inherent security feature of zero-knowledge architecture.
          </span>
        </p>
      </div>
    </div>
  )
}
