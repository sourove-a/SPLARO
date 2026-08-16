import { Injectable, Logger } from '@nestjs/common'
import type { ThrottlerStorage } from '@nestjs/throttler'
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface'
import { RedisService } from './redis.service'

type MemoryRecord = { hits: number; expiresAt: number; blockedUntil: number }

/**
 * Rate-limit counters shared across PM2 cluster workers.
 *
 * The default in-memory storage keeps one counter per worker, so with
 * `instances: 2` every `@Throttle` limit was effectively doubled and reset on
 * reload — `admin/auth/login` is declared 10/60s but only returned 429 after
 * ~20 attempts from a single IP. Counting in Redis makes the declared limit the
 * real limit no matter which worker answers.
 *
 * Redis being down must never take the API with it: the in-memory map below is
 * the fallback, which degrades back to per-worker counting rather than to no
 * limit at all.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name)
  private readonly memory = new Map<string, MemoryRecord>()
  private lastFallbackWarn = 0

  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const ttlMs = Math.max(1, Math.round(ttl))
    const blockMs = Math.max(0, Math.round(blockDuration))
    const namespaced = `splaro:throttle:${throttlerName}:${key}`

    // Never let a Redis fault reach the caller: this runs inside the global
    // guard, so a throw here would turn every request into a 500.
    let shared: { hits: number; expiresInMs: number } | null = null
    try {
      shared = await this.redis.throttleHit(namespaced, ttlMs)
    } catch {
      shared = null
    }
    if (!shared) return this.incrementInMemory(namespaced, ttlMs, limit, blockMs)

    // A blocked caller keeps hitting the same key, so the counter staying above
    // the limit is what holds the block open for the rest of the window.
    const isBlocked = shared.hits > limit
    const timeToExpire = Math.ceil(shared.expiresInMs / 1000)

    return {
      totalHits: shared.hits,
      timeToExpire,
      isBlocked,
      timeToBlockExpire: isBlocked ? timeToExpire : 0,
    }
  }

  private incrementInMemory(
    key: string,
    ttlMs: number,
    limit: number,
    blockMs: number,
  ): ThrottlerStorageRecord {
    const now = Date.now()
    if (now - this.lastFallbackWarn > 60_000) {
      this.lastFallbackWarn = now
      this.logger.warn('Redis unavailable — rate limits are per-worker until it recovers')
    }

    this.sweep(now)
    const existing = this.memory.get(key)
    const record: MemoryRecord =
      existing && existing.expiresAt > now
        ? existing
        : { hits: 0, expiresAt: now + ttlMs, blockedUntil: 0 }

    record.hits += 1
    if (record.hits > limit && blockMs > 0) {
      record.blockedUntil = Math.max(record.blockedUntil, now + blockMs)
    }
    this.memory.set(key, record)

    const isBlocked = record.hits > limit
    return {
      totalHits: record.hits,
      timeToExpire: Math.ceil((record.expiresAt - now) / 1000),
      isBlocked,
      timeToBlockExpire: isBlocked
        ? Math.ceil((Math.max(record.blockedUntil, record.expiresAt) - now) / 1000)
        : 0,
    }
  }

  /** Drop expired keys so a fallback window cannot grow without bound. */
  private sweep(now: number): void {
    if (this.memory.size < 5_000) return
    for (const [key, record] of this.memory) {
      if (record.expiresAt <= now && record.blockedUntil <= now) this.memory.delete(key)
    }
  }
}
