
'use client'

/**
 * Zero-Knowledge Signup Component
 * 
 * Handles user registration with zero-knowledge encryption
 */

import { useState } from 'react'
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

export function ZeroKnowledgeSignup() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailNote, setEmailNote] = useState('')

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Validate password match
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        setLoading(false)
        return
      }

      // Validate password strength
      if (password.length < 8) {
        setError('Password must be at least 8 characters long')
        setLoading(false)
        return
      }

      // Step 1: Create user account on server
      const signupResponse = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName
        })
      })

      const signupData = await signupResponse.json()

      if (!signupResponse.ok) {
        setError(signupData.message || 'Signup failed')
        setLoading(false)
        return
      }

      // Check if welcome email was sent
      if (signupData.emailNote) {
        setEmailNote(signupData.emailNote)
      }

      // Step 2: Automatically log in the user
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password
      })

      if (result?.error) {
        setError('Account created but login failed. Please try logging in manually.')
        setLoading(false)
        return
      }

      // Step 3: Fetch user's salt from server
      const saltResponse = await fetch('/api/user/salt')
      const { salt: saltHex } = await saltResponse.json()
      
      if (!saltHex) {
        throw new Error('Failed to retrieve encryption salt')
      }

      // Step 4: Derive encryption key from password (CLIENT-SIDE ONLY)
      const salt = hexToUint8Array(saltHex)
      const encryptionKey = await deriveKeyFromPassword(password, salt)

      // Step 5: Store key in memory (NEVER send to server)
      setSessionEncryptionKey(encryptionKey)

      // Step 6: Redirect to dashboard
      router.push('/dashboard')

    } catch (err) {
      console.error('Signup error:', err)
      setError('Signup failed. Please try again.')
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
          <strong className="font-orbitron">[ZERO-KNOWLEDGE SECURITY]:</strong> Your password will derive an encryption key that exists only in your browser. 
          The server will never have access to your sensitive data.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSignup} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="text-terminal-green font-share-tech">First Name</Label>
            <Input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="bg-black/60 border-terminal-green text-terminal-green placeholder:text-terminal-green/50 focus:shadow-terminal font-share-tech"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName" className="text-terminal-green font-share-tech">Last Name</Label>
            <Input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="bg-black/60 border-terminal-green text-terminal-green placeholder:text-terminal-green/50 focus:shadow-terminal font-share-tech"
            />
          </div>
        </div>

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
            minLength={8}
            className="bg-black/60 border-terminal-green text-terminal-green placeholder:text-terminal-green/50 focus:shadow-terminal font-share-tech"
          />
          <p className="text-xs text-terminal-green/70 font-share-tech">
            <Lock className="inline h-3 w-3 mr-1" />
            Minimum 8 characters. This password derives your encryption key.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-terminal-green font-share-tech">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className="bg-black/60 border-terminal-green text-terminal-green placeholder:text-terminal-green/50 focus:shadow-terminal font-share-tech"
          />
        </div>

        {error && (
          <Alert variant="destructive" className="bg-red-900/20 border-red-500 text-red-500">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {emailNote && (
          <Alert className="bg-yellow-900/20 border-yellow-500/50 text-yellow-300">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">{emailNote}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          className="w-full bg-terminal-green hover:bg-terminal-green/80 text-black font-bold font-orbitron tracking-wider shadow-terminal hover:shadow-terminal-lg transition-all"
          disabled={loading}
        >
          {loading ? 'Creating Account...' : 'Create Account'}
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
