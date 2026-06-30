import Redis from 'ioredis'

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.REDIS_URL
  if (!url || process.env.REDIS_ENABLED === 'false') return null

  try {
    redis = new Redis(url, {
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB ?? '0'),
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    })
    void redis.connect().catch(() => {
      redis = null
    })
    return redis
  } catch {
    return null
  }
}

export async function redisRateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<{ ok: boolean; remaining: number; retryAfter?: number }> {
  const client = getRedis()
  if (!client || client.status !== 'ready') {
    return { ok: true, remaining: max }
  }

  const ttlSeconds = Math.ceil(windowMs / 1000)
  const redisKey = `rl:${key}`

  try {
    const count = await client.incr(redisKey)
    if (count === 1) await client.expire(redisKey, ttlSeconds)
    if (count > max) {
      const ttl = await client.ttl(redisKey)
      return { ok: false, remaining: 0, retryAfter: ttl > 0 ? ttl : ttlSeconds }
    }
    return { ok: true, remaining: Math.max(0, max - count) }
  } catch {
    return { ok: true, remaining: max }
  }
}
