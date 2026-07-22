/**
 * Tests for the real rate limiter (lib/rate-limit.ts) — in-memory store path
 * (the Redis store path requires a live Redis and is exercised outside jest).
 */

import { checkRateLimit } from '@/lib/rate-limit'
import type { NextRequest } from 'next/server'

function fakeRequest(headers: Record<string, string>): NextRequest {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as NextRequest
}

let bucket = 0
/** Unique limiter name per test so buckets never leak between tests */
const nextName = () => `test-${++bucket}`

describe('checkRateLimit', () => {
  it('allows requests under the limit and blocks above it', async () => {
    const name = nextName()
    const req = fakeRequest({ 'x-forwarded-for': '10.1.1.1' })
    const config = { windowMs: 60_000, maxRequests: 3 }

    expect((await checkRateLimit(req, config, { name })).blocked).toBe(false)
    expect((await checkRateLimit(req, config, { name })).blocked).toBe(false)
    const third = await checkRateLimit(req, config, { name })
    expect(third.blocked).toBe(false)
    expect(third.remaining).toBe(0)
    expect((await checkRateLimit(req, config, { name })).blocked).toBe(true)
  })

  it('tracks clients independently by IP', async () => {
    const name = nextName()
    const config = { windowMs: 60_000, maxRequests: 1 }
    const a = fakeRequest({ 'x-forwarded-for': '10.2.2.2' })
    const b = fakeRequest({ 'x-forwarded-for': '10.3.3.3' })

    expect((await checkRateLimit(a, config, { name })).blocked).toBe(false)
    expect((await checkRateLimit(a, config, { name })).blocked).toBe(true)
    expect((await checkRateLimit(b, config, { name })).blocked).toBe(false)
  })

  it('gives each limiter name an independent bucket', async () => {
    const config = { windowMs: 60_000, maxRequests: 1 }
    const req = fakeRequest({ 'x-forwarded-for': '10.7.7.7' })
    const nameA = nextName()
    const nameB = nextName()

    expect((await checkRateLimit(req, config, { name: nameA })).blocked).toBe(false)
    expect((await checkRateLimit(req, config, { name: nameA })).blocked).toBe(true)
    // Same IP, different limiter — not blocked
    expect((await checkRateLimit(req, config, { name: nameB })).blocked).toBe(false)
  })

  it('prefers the authenticated user id over the IP', async () => {
    const name = nextName()
    const config = { windowMs: 60_000, maxRequests: 1 }
    const sameIp = fakeRequest({ 'x-forwarded-for': '10.8.8.8' })

    // Two users behind one IP get independent buckets
    expect((await checkRateLimit(sameIp, config, { name, userId: 'user-a' })).blocked).toBe(false)
    expect((await checkRateLimit(sameIp, config, { name, userId: 'user-b' })).blocked).toBe(false)
    // The same user from a different IP shares their bucket
    const otherIp = fakeRequest({ 'x-forwarded-for': '10.9.9.9' })
    expect((await checkRateLimit(otherIp, config, { name, userId: 'user-a' })).blocked).toBe(true)
  })

  it('uses the first IP in a forwarded chain', async () => {
    const name = nextName()
    const config = { windowMs: 60_000, maxRequests: 1 }
    const direct = fakeRequest({ 'x-forwarded-for': '10.4.4.4' })
    const chained = fakeRequest({ 'x-forwarded-for': '10.4.4.4, 172.16.0.1' })

    expect((await checkRateLimit(direct, config, { name })).blocked).toBe(false)
    // Same client IP at the head of the chain shares the bucket
    expect((await checkRateLimit(chained, config, { name })).blocked).toBe(true)
  })

  it('resets after the window expires', async () => {
    jest.useFakeTimers()
    try {
      const name = nextName()
      const req = fakeRequest({ 'x-forwarded-for': '10.5.5.5' })
      const config = { windowMs: 1_000, maxRequests: 1 }

      expect((await checkRateLimit(req, config, { name })).blocked).toBe(false)
      expect((await checkRateLimit(req, config, { name })).blocked).toBe(true)

      jest.advanceTimersByTime(1_500)
      expect((await checkRateLimit(req, config, { name })).blocked).toBe(false)
    } finally {
      jest.useRealTimers()
    }
  })

  it('reports a reset time in the future', async () => {
    const name = nextName()
    const req = fakeRequest({ 'x-real-ip': '10.6.6.6' })
    const result = await checkRateLimit(req, { windowMs: 60_000, maxRequests: 5 }, { name })
    expect(result.resetTime).toBeGreaterThan(Date.now())
  })
})
