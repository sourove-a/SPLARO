import { Injectable } from '@nestjs/common'
import { RedisService } from './redis.service'

@Injectable()
export class CacheService {
  constructor(private readonly redis: RedisService) {}

  async getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.redis.getJson<T>(key)
    if (cached !== null) return cached

    const fresh = await loader()
    void this.redis.setJson(key, fresh, ttlSeconds)
    return fresh
  }

  storeKey(storeId: string, resource: string, suffix = ''): string {
    return `splaro:${storeId}:${resource}${suffix ? `:${suffix}` : ''}`
  }

  async invalidateStoreResource(storeId: string, resource: string): Promise<void> {
    const base = this.storeKey(storeId, resource)
    await this.redis.del(base)
    await this.redis.delByPattern(`${base}:*`)
  }
}
