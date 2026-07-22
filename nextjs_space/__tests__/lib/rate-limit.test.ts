/**
 * Tests for the real rate limiter (lib/rate-limit.ts)
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

describe('checkRateLimit', () => {
  it('allows requests under the limit and blocks above it', () => {
    const req = fakeRequest({ 'x-forwarded-for': '10.1.1.1' })
    const config = { windowMs: 60_000, maxRequests: 3 }

    expect(checkRateLimit(req, config).blocked).toBe(false)
    expect(checkRateLimit(req, config).blocked).toBe(false)
    const third = checkRateLimit(req, config)
    expect(third.blocked).toBe(false)
    expect(third.remaining).toBe(0)
    expect(checkRateLimit(req, config).blocked).toBe(true)
  })

  it('tracks clients independently by IP', () => {
    const config = { windowMs: 60_000, maxRequests: 1 }
    const a = fakeRequest({ 'x-forwarded-for': '10.2.2.2' })
    const b = fakeRequest({ 'x-forwarded-for': '10.3.3.3' })

    expect(checkRateLimit(a, config).blocked).toBe(false)
    expect(checkRateLimit(a, config).blocked).toBe(true)
    expect(checkRateLimit(b, config).blocked).toBe(false)
  })

  it('uses the first IP in a forwarded chain', () => {
    const config = { windowMs: 60_000, maxRequests: 1 }
    const direct = fakeRequest({ 'x-forwarded-for': '10.4.4.4' })
    const chained = fakeRequest({ 'x-forwarded-for': '10.4.4.4, 172.16.0.1' })

    expect(checkRateLimit(direct, config).blocked).toBe(false)
    // Same client IP at the head of the chain shares the bucket
    expect(checkRateLimit(chained, config).blocked).toBe(true)
  })

  it('resets after the window expires', () => {
    jest.useFakeTimers()
    try {
      const req = fakeRequest({ 'x-forwarded-for': '10.5.5.5' })
      const config = { windowMs: 1_000, maxRequests: 1 }

      expect(checkRateLimit(req, config).blocked).toBe(false)
      expect(checkRateLimit(req, config).blocked).toBe(true)

      jest.advanceTimersByTime(1_500)
      expect(checkRateLimit(req, config).blocked).toBe(false)
    } finally {
      jest.useRealTimers()
    }
  })

  it('reports a reset time in the future', () => {
    const req = fakeRequest({ 'x-real-ip': '10.6.6.6' })
    const result = checkRateLimit(req, { windowMs: 60_000, maxRequests: 5 })
    expect(result.resetTime).toBeGreaterThan(Date.now())
  })
})
