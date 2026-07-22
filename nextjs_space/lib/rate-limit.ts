
/**
 * Rate Limiting
 *
 * Fixed-window rate limiting with a pluggable store:
 *  - With REDIS_URL set, counters live in Redis (INCR + PEXPIRE), so limits
 *    hold across instances and restarts — required for horizontal scaling.
 *  - Otherwise an in-memory store is used (single-instance only).
 *  - Redis errors fall back to the in-memory store (and log) rather than
 *    blocking traffic or silently disabling limits.
 *
 * Keys are namespaced per limiter (auth/api/query) — previously all limiters
 * shared one bucket per IP — and are keyed by authenticated user id when the
 * caller provides one, falling back to client IP (which is spoofable via
 * x-forwarded-for when not behind a trusted proxy).
 */

import { NextRequest } from 'next/server';

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
}

export interface RateLimitResult {
  blocked: boolean;
  remaining: number;
  resetTime: number;
}

interface RateLimitStore {
  /** Increment the counter for key, creating it with the window TTL if absent */
  increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }>;
}

// ---------------------------------------------------------------------------
// In-memory store (single instance)
// ---------------------------------------------------------------------------

interface MemoryEntry {
  count: number;
  resetTime: number;
}

class InMemoryStore implements RateLimitStore {
  private entries = new Map<string, MemoryEntry>();

  constructor() {
    // Clean up old entries every 5 minutes (unref'd so it never holds the
    // process open — e.g. test runners and one-off scripts)
    const timer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.entries) {
        if (entry.resetTime < now) this.entries.delete(key);
      }
    }, 5 * 60 * 1000);
    if (typeof timer.unref === 'function') timer.unref();
  }

  async increment(key: string, windowMs: number) {
    const now = Date.now();
    let entry = this.entries.get(key);
    if (!entry || entry.resetTime < now) {
      entry = { count: 0, resetTime: now + windowMs };
      this.entries.set(key, entry);
    }
    entry.count++;
    return { count: entry.count, resetTime: entry.resetTime };
  }
}

// ---------------------------------------------------------------------------
// Redis store (multi-instance)
// ---------------------------------------------------------------------------

class RedisStore implements RateLimitStore {
  private client: import('ioredis').Redis;

  constructor(url: string) {
    // Lazy import keeps ioredis out of bundles that never configure Redis
    const IORedis = require('ioredis') as typeof import('ioredis').default;
    // Offline queue stays enabled so commands issued during the initial
    // connect (or a brief reconnect) wait instead of failing straight to the
    // in-memory fallback; maxRetriesPerRequest bounds how long they wait.
    this.client = new IORedis(url, {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
    });
    this.client.on('error', (err: Error) => {
      console.error('[rate-limit] Redis error:', err.message);
    });
  }

  async increment(key: string, windowMs: number) {
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.pexpire(key, windowMs);
    }
    const ttl = await this.client.pttl(key);
    return {
      count,
      resetTime: Date.now() + (ttl > 0 ? ttl : windowMs),
    };
  }
}

// ---------------------------------------------------------------------------
// Store selection
// ---------------------------------------------------------------------------

const memoryStore = new InMemoryStore();
let redisStore: RedisStore | null = null;

function getStore(): RateLimitStore {
  if (process.env.REDIS_URL) {
    if (!redisStore) {
      try {
        redisStore = new RedisStore(process.env.REDIS_URL);
        console.log('[rate-limit] Using Redis store');
      } catch (error) {
        console.error('[rate-limit] Failed to initialize Redis store, using in-memory:', error);
      }
    }
    if (redisStore) return redisStore;
  }
  return memoryStore;
}

/**
 * Get client identifier from request (best-effort — forwarded headers are
 * spoofable unless a trusted proxy strips them)
 */
function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');

  return (
    forwarded?.split(',')[0]?.trim() ||
    realIp ||
    cfConnectingIp ||
    'unknown'
  );
}

/**
 * Check if a request should be rate limited.
 *
 * @param name    Limiter namespace (each limiter gets independent buckets)
 * @param userId  Authenticated user id — preferred key when available, since
 *                client IP headers can be spoofed
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  options?: { name?: string; userId?: string }
): Promise<RateLimitResult> {
  const name = options?.name ?? 'default';
  const key = options?.userId
    ? `rl:${name}:user:${options.userId}`
    : `rl:${name}:ip:${getClientIdentifier(request)}`;

  let count: number;
  let resetTime: number;
  try {
    ({ count, resetTime } = await getStore().increment(key, config.windowMs));
  } catch (error) {
    // Redis unreachable mid-flight: degrade to the in-memory store so limits
    // still apply per instance instead of failing the request
    console.error('[rate-limit] Store error, falling back to in-memory:', error);
    ({ count, resetTime } = await memoryStore.increment(key, config.windowMs));
  }

  return {
    blocked: count > config.maxRequests,
    remaining: Math.max(0, config.maxRequests - count),
    resetTime,
  };
}

/**
 * Rate limiter for authentication routes
 * Stricter limits to prevent brute force attacks
 */
export function authRateLimiter(request: NextRequest, userId?: string) {
  return checkRateLimit(request, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5 // 5 attempts per 15 minutes
  }, { name: 'auth', userId });
}

/**
 * Rate limiter for general API routes
 * More lenient for normal API usage
 */
export function apiRateLimiter(request: NextRequest, userId?: string) {
  return checkRateLimit(request, {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 30 // 30 requests per minute
  }, { name: 'api', userId });
}

/**
 * Rate limiter for query endpoints
 * Balance between usability and resource protection
 */
export function queryRateLimiter(request: NextRequest, userId?: string) {
  return checkRateLimit(request, {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 10 // 10 queries per minute
  }, { name: 'query', userId });
}
