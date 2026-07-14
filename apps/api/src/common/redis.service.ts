import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { randomBytes } from 'crypto'
import Redis from 'ioredis'

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)
  private client: Redis | null = null
  private readonly enabled: boolean

  constructor() {
    const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
    this.enabled = process.env['REDIS_ENABLED'] !== 'false'
    const isProd = process.env['NODE_ENV'] === 'production'

    if (!this.enabled) {
      this.logger.warn('Redis disabled — set REDIS_ENABLED=true for production caching')
      return
    }

    try {
      this.client = new Redis(url, {
        password: process.env['REDIS_PASSWORD'] || undefined,
        db: Number(process.env['REDIS_DB'] ?? '0'),
        maxRetriesPerRequest: 2,
        lazyConnect: true,
        enableOfflineQueue: false,
      })
      this.client.on('error', (err: Error) => {
        this.logger.debug(`Redis client error: ${err.message}`)
      })
      void this.client.connect().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'connect failed'
        if (isProd) {
          this.logger.error(
            `Redis unavailable in production — OTP/cache degraded until Redis is up: ${message}`,
          )
        } else {
          this.logger.warn(`Redis unavailable: ${message}`)
        }
        this.client = null
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown'
      if (isProd) {
        this.logger.error(`Redis init failed in production: ${message}`)
      } else {
        this.logger.warn(`Redis init failed: ${message}`)
      }
      this.client = null
    }
  }

  get isReady(): boolean {
    return this.client?.status === 'ready'
  }

  async ping(): Promise<boolean> {
    if (!this.enabled) return false
    if (!this.client) await this.ensureClient()
    if (!this.client) return false
    try {
      return (await this.client.ping()) === 'PONG'
    } catch {
      return false
    }
  }

  private async ensureClient(): Promise<void> {
    if (!this.enabled || this.client) return
    const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
    try {
      const client = new Redis(url, {
        password: process.env['REDIS_PASSWORD'] || undefined,
        db: Number(process.env['REDIS_DB'] ?? '0'),
        maxRetriesPerRequest: 2,
        lazyConnect: true,
        enableOfflineQueue: false,
      })
      client.on('error', (err: Error) => {
        this.logger.debug(`Redis client error: ${err.message}`)
      })
      await client.connect()
      this.client = client
      this.logger.log('Redis connected (late init)')
    } catch (err) {
      this.logger.warn(
        `Redis reconnect failed: ${err instanceof Error ? err.message : 'connect failed'}`,
      )
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.client) await this.ensureClient()
    if (!this.client) return null
    try {
      const raw = await this.client.get(key)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.client) await this.ensureClient()
    if (!this.client) return
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    } catch {
      /* cache miss is acceptable */
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) await this.ensureClient()
    if (!this.client) return
    try {
      await this.client.del(key)
    } catch {
      /* cache miss is acceptable */
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    if (!this.client) await this.ensureClient()
    if (!this.client) return
    try {
      let cursor = '0'
      do {
        const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
        cursor = next
        if (keys.length) await this.client.del(...keys)
      } while (cursor !== '0')
    } catch {
      /* cache miss is acceptable */
    }
  }

  async getCounter(key: string): Promise<number> {
    if (!this.client) await this.ensureClient()
    if (!this.client) return 0
    try {
      const raw = await this.client.get(key)
      if (!raw) return 0
      const parsed = Number.parseInt(raw, 10)
      return Number.isFinite(parsed) ? parsed : 0
    } catch {
      return 0
    }
  }

  async incrWithExpiry(key: string, ttlSeconds: number): Promise<number> {
    if (!this.client) await this.ensureClient()
    if (!this.client) return 0
    try {
      const count = await this.client.incr(key)
      if (count === 1) await this.client.expire(key, ttlSeconds)
      return count
    } catch {
      return 0
    }
  }

  /** SET NX lock — returns token when acquired, null when held by another caller. */
  async tryAcquireLock(key: string, ttlSeconds: number): Promise<string | null> {
    if (!this.client) await this.ensureClient()
    if (!this.client) return null
    const token = randomBytes(16).toString('hex')
    try {
      const ok = await this.client.set(key, token, 'EX', ttlSeconds, 'NX')
      return ok === 'OK' ? token : null
    } catch {
      return null
    }
  }

  /** Release lock only if token still matches (safe unlock). */
  async releaseLock(key: string, token: string): Promise<void> {
    if (!this.client) return
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `
    try {
      await this.client.eval(script, 1, key, token)
    } catch {
      /* lock will expire via TTL */
    }
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => undefined)
  }
}
