'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AuthPage } from '@/components/auth-page';

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession() || {};

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

  useEffect(() => {
    // Allow natural scrolling - removed overflow hidden as it can cause layout issues
    return () => {
      // Cleanup function
    };
  }, []);

  if (status === 'loading') {
    return null;
  }

  return <AuthPage />;
}
