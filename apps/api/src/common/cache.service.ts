import { Injectable } from '@nestjs/common'
import { RedisService } from './redis.service'

const L1_TTL_MS = 5_000

type L1Entry = { value: unknown; expires: number }

@Injectable()
export class CacheService {
  private readonly inflight = new Map<string, Promise<unknown>>()
  private readonly l1 = new Map<string, L1Entry>()

  constructor(private readonly redis: RedisService) {}

  async getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const l1Hit = this.l1.get(key)
    if (l1Hit && l1Hit.expires > Date.now()) return l1Hit.value as T

    const cached = await this.redis.getJson<T>(key)
    if (cached !== null) {
      this.setL1(key, cached)
      return cached
    }

    const pending = this.inflight.get(key)
    if (pending) return pending as Promise<T>

    const promise = (async () => {
      try {
        const fresh = await loader()
        void this.redis.setJson(key, fresh, ttlSeconds)
        this.setL1(key, fresh)
        return fresh
      } finally {
        this.inflight.delete(key)
      }
    })()

    this.inflight.set(key, promise)
    return promise
  }

  storeKey(storeId: string, resource: string, suffix = ''): string {
    return `splaro:${storeId}:${resource}${suffix ? `:${suffix}` : ''}`
  }

  async invalidateStoreResource(storeId: string, resource: string): Promise<void> {
    const base = this.storeKey(storeId, resource)
    await this.redis.del(base)
    await this.redis.delByPattern(`${base}:*`)
    this.clearL1ForStore(storeId)
  }

  /** Bust all storefront catalog keys after product/category/collection writes. */
  async invalidateCatalog(storeId: string): Promise<void> {
    await Promise.all([
      this.invalidateStoreResource(storeId, 'products'),
      this.invalidateStoreResource(storeId, 'product'),
      this.invalidateStoreResource(storeId, 'categories'),
      this.invalidateStoreResource(storeId, 'collections'),
      this.invalidateStoreResource(storeId, 'nav'),
    ])
  }

  private setL1(key: string, value: unknown): void {
    this.l1.set(key, { value, expires: Date.now() + L1_TTL_MS })
  }

  private clearL1ForStore(storeId: string): void {
    const prefix = `splaro:${storeId}:`
    for (const key of this.l1.keys()) {
      if (key.startsWith(prefix)) this.l1.delete(key)
    }
  }
}
