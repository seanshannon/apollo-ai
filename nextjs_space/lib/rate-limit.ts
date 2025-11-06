
/**
 * Rate Limiting Implementation
 * Protects API endpoints from abuse and brute force attacks
 */

import { NextRequest } from 'next/server';

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
// In production, use Redis or another distributed cache
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Get client identifier from request
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get IP address from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  const ip = forwarded?.split(',')[0]?.trim() || 
             realIp || 
             cfConnectingIp || 
             'unknown';
  
  return ip;
}

/**
 * Check if request should be rate limited
 * Returns true if request should be blocked
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): { blocked: boolean; remaining: number; resetTime: number } {
  const clientId = getClientIdentifier(request);
  const now = Date.now();
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(clientId);
  
  if (!entry || entry.resetTime < now) {
    // Create new entry or reset expired entry
    entry = {
      count: 0,
      resetTime: now + config.windowMs
    };
    rateLimitStore.set(clientId, entry);
  }
  
  // Increment request count
  entry.count++;
  
  const blocked = entry.count > config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  
  return {
    blocked,
    remaining,
    resetTime: entry.resetTime
  };
}

/**
 * Rate limiter middleware for authentication routes
 * Stricter limits to prevent brute force attacks
 */
export function authRateLimiter(request: NextRequest) {
  return checkRateLimit(request, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5 // 5 attempts per 15 minutes
  });
}

/**
 * Rate limiter middleware for general API routes
 * More lenient for normal API usage
 */
export function apiRateLimiter(request: NextRequest) {
  return checkRateLimit(request, {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 30 // 30 requests per minute
  });
}

/**
 * Rate limiter for query endpoints
 * Balance between usability and resource protection
 */
export function queryRateLimiter(request: NextRequest) {
  return checkRateLimit(request, {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 10 // 10 queries per minute
  });
}
