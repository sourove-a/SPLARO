import { RedisService } from './redis.service'

const LOCAL_LOCKS = new Map<string, { token: string; expiresAt: number }>()

function pruneLocalLocks() {
  const now = Date.now()
  for (const [key, entry] of LOCAL_LOCKS) {
    if (entry.expiresAt <= now) LOCAL_LOCKS.delete(key)
  }
}

/**
 * Acquire a lock. When Redis is ready, NX failure means contention — never fall
 * through to a process-local lock (that caused dual Steadfast bookings).
 * Local locks are only used when Redis is unavailable (REDIS_ENABLED=false or down).
 */
async function tryAcquireAnyLock(
  redis: RedisService,
  key: string,
  ttlSeconds: number,
): Promise<string | null> {
  if (redis.isReady) {
    return redis.tryAcquireLock(key, ttlSeconds)
  }

  pruneLocalLocks()
  if (LOCAL_LOCKS.has(key)) return null
  const token = `local-${Date.now()}`
  LOCAL_LOCKS.set(key, { token, expiresAt: Date.now() + ttlSeconds * 1000 })
  return token
}

async function releaseAnyLock(redis: RedisService, key: string, token: string): Promise<void> {
  if (token.startsWith('local-')) {
    const entry = LOCAL_LOCKS.get(key)
    if (entry?.token === token) LOCAL_LOCKS.delete(key)
    return
  }
  await redis.releaseLock(key, token)
}

export async function withDistributedLock<T>(
  redis: RedisService,
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T | null> {
  const token = await tryAcquireAnyLock(redis, key, ttlSeconds)
  if (!token) return null
  try {
    return await fn()
  } finally {
    await releaseAnyLock(redis, key, token)
  }
}
