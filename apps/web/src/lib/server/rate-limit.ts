import { redisRateLimit } from './redis-rate-limit'

const buckets = new Map<string, { count: number; resetAt: number }>()

export interface RateLimitResult {
  ok: boolean
  remaining: number
  retryAfter?: number
}

function memoryRateLimit(
  key: string,
  max: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: max - 1 }
  }

  if (bucket.count >= max) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
    }
  }

  bucket.count += 1
  buckets.set(key, bucket)
  return { ok: true, remaining: max - bucket.count }
}

export async function rateLimit(
  key: string,
  max = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100'),
  windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? `${15 * 60 * 1000}`),
): Promise<RateLimitResult> {
  const redis = await redisRateLimit(key, max, windowMs)
  if (redis.remaining < max || !redis.ok) return redis
  return memoryRateLimit(key, max, windowMs)
}

export function getClientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || 'local'
  return `${scope}:${ip}`
}
