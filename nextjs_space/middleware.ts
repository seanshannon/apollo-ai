
/**
 * Middleware for adding security headers to all responses
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Check if the cookie header is too large (> 8KB is problematic for some servers)
  const cookieHeader = request.headers.get('cookie') || ''
  const cookieSize = new Blob([cookieHeader]).size
  
  // If cookies are too large (likely old JWT with image), force logout to get fresh tokens
  if (cookieSize > 7000 && request.nextUrl.pathname.startsWith('/dashboard')) {
    const signoutUrl = new URL('/api/auth/signout', request.url)
    signoutUrl.searchParams.set('callbackUrl', '/')
    return NextResponse.redirect(signoutUrl)
  }
  
  // Clone the request headers
  const requestHeaders = new Headers(request.headers)

  // Create response
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // Add security headers
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apps.abacus.ai https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https://fonts.gstatic.com https://raw.githubusercontent.com",
      "connect-src 'self' https://apps.abacus.ai wss: ws: https://*.tile.openstreetmap.org",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  )

  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // Only set HSTS in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  return response
}

// Apply middleware to all routes
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
