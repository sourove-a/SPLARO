import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import Redis from 'ioredis'

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)
  private client: Redis | null = null
  private readonly enabled: boolean

  constructor() {
    const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
    this.enabled = process.env['REDIS_ENABLED'] !== 'false'

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
        this.logger.warn(`Redis unavailable: ${err instanceof Error ? err.message : 'connect failed'}`)
        this.client = null
      })
    } catch (err) {
      this.logger.warn(`Redis init failed: ${err instanceof Error ? err.message : 'unknown'}`)
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

  async incrWithExpiry(key: string, ttlSeconds: number): Promise<number> {
    if (!this.client) return 0
    try {
      const count = await this.client.incr(key)
      if (count === 1) await this.client.expire(key, ttlSeconds)
      return count
    } catch {
      return 0
    }
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => undefined)
  }
}
