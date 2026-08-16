import type { RedisService } from './redis.service'
import { RedisThrottlerStorage } from './redis-throttler.storage'

/** Single shared counter, as Redis behaves for every worker hitting one key. */
function sharedRedis() {
  const counters = new Map<string, { hits: number; expiresAt: number }>()
  const throttleHit = jest.fn(async (key: string, ttlMs: number) => {
    const now = Date.now()
    const row = counters.get(key)
    const live = row && row.expiresAt > now ? row : { hits: 0, expiresAt: now + ttlMs }
    live.hits += 1
    counters.set(key, live)
    return { hits: live.hits, expiresInMs: live.expiresAt - now }
  })
  return { redis: { throttleHit } as unknown as RedisService, throttleHit, counters }
}

const downRedis = () =>
  ({ throttleHit: jest.fn().mockResolvedValue(null) }) as unknown as RedisService

describe('RedisThrottlerStorage', () => {
  it('counts one shared window across two workers', async () => {
    const { redis } = sharedRedis()
    // Two storage instances = two PM2 cluster workers against one Redis.
    const workerA = new RedisThrottlerStorage(redis)
    const workerB = new RedisThrottlerStorage(redis)

    const hits: number[] = []
    for (let i = 0; i < 6; i++) {
      const worker = i % 2 === 0 ? workerA : workerB
      const record = await worker.increment('ip:1.2.3.4', 60_000, 10, 0, 'default')
      hits.push(record.totalHits)
    }

    // Per-worker counting would produce 1,1,2,2,3,3 — the bug this replaces.
    expect(hits).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('blocks at the declared limit no matter which worker answers', async () => {
    const { redis } = sharedRedis()
    const workers = [new RedisThrottlerStorage(redis), new RedisThrottlerStorage(redis)]

    let blockedAt = 0
    for (let i = 1; i <= 14; i++) {
      const record = await workers[i % 2]!.increment('ip:9.9.9.9', 60_000, 10, 0, 'default')
      if (record.isBlocked && !blockedAt) blockedAt = i
    }

    expect(blockedAt).toBe(11)
  })

  it('namespaces by throttler name so per-route limits stay separate', async () => {
    const { redis, throttleHit } = sharedRedis()
    const storage = new RedisThrottlerStorage(redis)

    await storage.increment('ip:1', 60_000, 10, 0, 'default')
    await storage.increment('ip:1', 60_000, 5, 0, 'login')

    const keys = throttleHit.mock.calls.map((call) => call[0])
    expect(keys).toEqual(['splaro:throttle:default:ip:1', 'splaro:throttle:login:ip:1'])
    expect(new Set(keys).size).toBe(2)
  })

  it('reports the remaining window in seconds', async () => {
    const { redis } = sharedRedis()
    const storage = new RedisThrottlerStorage(redis)
    const record = await storage.increment('ip:2', 60_000, 10, 0, 'default')
    expect(record.timeToExpire).toBeGreaterThan(0)
    expect(record.timeToExpire).toBeLessThanOrEqual(60)
  })

  describe('when Redis is down', () => {
    it('keeps limiting in memory instead of letting traffic through', async () => {
      const storage = new RedisThrottlerStorage(downRedis())

      let blockedAt = 0
      for (let i = 1; i <= 8; i++) {
        const record = await storage.increment('ip:3', 60_000, 5, 0, 'default')
        if (record.isBlocked && !blockedAt) blockedAt = i
      }

      expect(blockedAt).toBe(6)
    })

    it('does not share the window between workers — the documented degradation', async () => {
      const redis = downRedis()
      const workerA = new RedisThrottlerStorage(redis)
      const workerB = new RedisThrottlerStorage(redis)

      const a = await workerA.increment('ip:4', 60_000, 10, 0, 'default')
      const b = await workerB.increment('ip:4', 60_000, 10, 0, 'default')

      expect([a.totalHits, b.totalHits]).toEqual([1, 1])
    })
  })
})

describe('RedisThrottlerStorage fault tolerance', () => {
  it('falls back instead of throwing when the Redis call rejects', async () => {
    const redis = {
      throttleHit: jest.fn().mockRejectedValue(new Error('ECONNRESET')),
    } as unknown as RedisService
    const storage = new RedisThrottlerStorage(redis)

    // This runs inside the global guard — a throw here would 500 every request.
    const record = await storage.increment('ip:boom', 60_000, 5, 0, 'default')
    expect(record.totalHits).toBe(1)
    expect(record.isBlocked).toBe(false)
  })

  it('falls back when the client has no throttleHit at all', async () => {
    const storage = new RedisThrottlerStorage({} as unknown as RedisService)
    const record = await storage.increment('ip:legacy', 60_000, 5, 0, 'default')
    expect(record.totalHits).toBe(1)
  })
})
