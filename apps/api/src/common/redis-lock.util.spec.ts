import { withDistributedLock } from './redis-lock.util'
import type { RedisService } from './redis.service'

function mockRedis(opts: { ready: boolean; token?: string | null }): RedisService {
  return {
    isReady: opts.ready,
    tryAcquireLock: jest.fn(async () => (opts.token === undefined ? null : opts.token)),
    releaseLock: jest.fn(async () => undefined),
  } as unknown as RedisService
}

describe('withDistributedLock', () => {
  it('when Redis ready and lock held, does not fall through to local — returns null', async () => {
    const redis = mockRedis({ ready: true, token: null })
    const fn = jest.fn(async () => 'ran')
    const result = await withDistributedLock(redis, 'test:lock:a', 30, fn)
    expect(result).toBeNull()
    expect(fn).not.toHaveBeenCalled()
  })

  it('when Redis ready and lock acquired, runs critical section', async () => {
    const redis = mockRedis({ ready: true, token: 'abc' })
    const result = await withDistributedLock(redis, 'test:lock:b', 30, async () => 42)
    expect(result).toBe(42)
    expect(redis.releaseLock).toHaveBeenCalledWith('test:lock:b', 'abc')
  })

  it('when Redis unavailable, uses local lock', async () => {
    const redis = mockRedis({ ready: false })
    const result = await withDistributedLock(redis, 'test:lock:c', 30, async () => 'local')
    expect(result).toBe('local')
  })
})
