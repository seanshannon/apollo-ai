'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { ZeroKnowledgeAuth } from './zero-knowledge-auth';
import { ZeroKnowledgeSignup } from './zero-knowledge-signup';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        const result = await signIn('credentials', {
          redirect: false,
          email,
          password,
        });

        if (result?.error) {
          setError('Invalid email or password');
        } else {
          router.push('/dashboard');
        }
      } else {
        // Signup logic handled by ZeroKnowledgeAuth component
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const starImageUrl = 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/1231630/stars.png';

  if (!isLogin) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center p-4 overflow-x-hidden">
        {/* Animated star layers */}
        <div className="fixed inset-0 w-full h-full pointer-events-none">
          <div 
            className="absolute top-0 left-0 w-[200%] h-[200%] bg-repeat animate-star-slow opacity-30"
            style={{ backgroundImage: `url(${starImageUrl})` }}
          />
        </div>
        <div className="fixed inset-0 w-full h-full pointer-events-none">
          <div 
            className="absolute top-0 left-0 w-[200%] h-[200%] bg-repeat animate-star-medium opacity-20"
            style={{ backgroundImage: `url(${starImageUrl})` }}
          />
        </div>
        <div className="fixed inset-0 w-full h-full pointer-events-none">
          <div 
            className="absolute top-0 left-0 w-[200%] h-[200%] bg-repeat animate-star-fast opacity-10"
            style={{ backgroundImage: `url(${starImageUrl})` }}
          />
        </div>

        <div className="relative z-10 w-full max-w-md">
          <ZeroKnowledgeSignup />
          <p className="text-center mt-4 text-terminal-green font-share-tech">
            Already have an account?{' '}
            <button
              onClick={() => setIsLogin(true)}
              className="text-terminal-green underline hover:text-white transition-colors"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-4 overflow-x-hidden">
      {/* Animated star layers */}
      <div className="fixed inset-0 w-full h-full pointer-events-none">
        <div 
          className="absolute top-0 left-0 w-[200%] h-[200%] bg-repeat animate-star-slow opacity-30"
          style={{ backgroundImage: `url(${starImageUrl})` }}
        />
      </div>
      <div className="fixed inset-0 w-full h-full pointer-events-none">
        <div 
          className="absolute top-0 left-0 w-[200%] h-[200%] bg-repeat animate-star-medium opacity-20"
          style={{ backgroundImage: `url(${starImageUrl})` }}
        />
      </div>
      <div className="fixed inset-0 w-full h-full pointer-events-none">
        <div 
          className="absolute top-0 left-0 w-[200%] h-[200%] bg-repeat animate-star-fast opacity-10"
          style={{ backgroundImage: `url(${starImageUrl})` }}
        />
      </div>

      {/* Scan line effect */}
      <div className="scan-line pointer-events-none" aria-hidden="true" />

      <Card 
        className="relative z-10 w-full max-w-md bg-black/80 border-2 border-terminal-green shadow-terminal backdrop-blur-sm"
        role="region"
        aria-labelledby="auth-title"
      >
        <CardHeader className="space-y-1">
          <CardTitle 
            id="auth-title"
            className="text-2xl font-terminator text-terminal-green text-center tracking-wider"
          >
            PICARD.AI
          </CardTitle>
          <CardDescription className="text-terminal-green/70 text-center font-share-tech">
            {isLogin ? 'System Access' : 'Initialize New User'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form 
            onSubmit={handleSubmit} 
            className="space-y-4"
            aria-label={isLogin ? 'Sign in form' : 'Sign up form'}
            noValidate
          >
            {error && (
              <Alert 
                id="auth-error"
                variant="destructive" 
                className="bg-red-900/20 border-red-500 text-red-500"
                role="alert"
                aria-live="assertive"
              >
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-terminal-green font-share-tech">
                Email Address
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="user@system.net"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="email"
                aria-required="true"
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? 'auth-error' : undefined}
                className="bg-black/60 border-terminal-green text-terminal-green placeholder:text-terminal-green/50 focus:shadow-terminal font-share-tech"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-terminal-green font-share-tech">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                aria-required="true"
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? 'auth-error' : undefined}
                className="bg-black/60 border-terminal-green text-terminal-green placeholder:text-terminal-green/50 focus:shadow-terminal font-share-tech"
              />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-terminal-green font-share-tech">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                  aria-required="true"
                  aria-invalid={error ? 'true' : 'false'}
                  aria-describedby={error ? 'auth-error' : undefined}
                  className="bg-black/60 border-terminal-green text-terminal-green placeholder:text-terminal-green/50 focus:shadow-terminal font-share-tech"
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-terminal-green hover:bg-terminal-green/80 text-black font-bold font-orbitron tracking-wider shadow-terminal hover:shadow-terminal-lg transition-all"
              disabled={isLoading}
              aria-busy={isLoading}
              aria-label={isLoading ? 'Processing...' : isLogin ? 'Sign in to Picard.ai' : 'Create new account'}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-1 h-4 bg-black animate-blink" aria-hidden="true" />
                  PROCESSING...
                </span>
              ) : (
                isLogin ? 'ACCESS SYSTEM' : 'INITIALIZE USER'
              )}
            </Button>
          </form>

          {isLogin && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-terminal-green/30" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-black px-2 text-terminal-green/70 font-share-tech">
                    Or continue with
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full bg-black/60 border-terminal-green text-terminal-green hover:bg-terminal-green/10 hover:text-terminal-green font-share-tech tracking-wider transition-all"
                onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                disabled={isLoading}
                aria-label="Sign in with Google"
              >
                <svg className="mr-2 h-4 w-4" aria-hidden="true" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                GOOGLE SSO
              </Button>
            </>
          )}

          <div className="mt-4 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-terminal-green hover:text-white transition-colors font-share-tech"
              disabled={isLoading}
              aria-label={isLogin ? 'Switch to sign up form' : 'Switch to sign in form'}
            >
              {isLogin ? (
                <>New user? <span className="underline">Initialize account</span></>
              ) : (
                <>Existing user? <span className="underline">Access system</span></>
              )}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
