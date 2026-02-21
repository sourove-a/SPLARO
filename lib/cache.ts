import { setTimeout as sleep } from 'node:timers/promises';

export interface CacheStore {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  wrap<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T>;
}

type MemoryEntry = {
  value: string;
  expiresAt: number;
};

class MemoryCacheStore implements CacheStore {
  private entries = new Map<string, MemoryEntry>();

  async get<T = unknown>(key: string): Promise<T | null> {
    const hit = this.entries.get(key);
    if (!hit) return null;
    if (hit.expiresAt < Date.now()) {
      this.entries.delete(key);
      return null;
    }
    try {
      return JSON.parse(hit.value) as T;
    } catch {
      this.entries.delete(key);
      return null;
    }
  }

  async set<T = unknown>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.entries.set(key, {
      value: JSON.stringify(value),
      expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async wrap<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const computed = await fn();
    await this.set(key, computed, ttlSeconds);
    return computed;
  }
}

class UpstashRestCacheStore implements CacheStore {
  constructor(private readonly restUrl: string, private readonly token: string) {}

  private async request<T = unknown>(path: string, retries = 2): Promise<T | null> {
    let attempt = 0;
    let delayMs = 150;

    while (attempt <= retries) {
      attempt += 1;
      try {
        const response = await fetch(`${this.restUrl}${path}`, {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
          cache: 'no-store',
        });

        if (response.ok) {
          const payload = (await response.json()) as { result?: T };
          return payload.result ?? null;
        }
      } catch {
        // retry below
      }

      if (attempt <= retries) {
        await sleep(delayMs);
        delayMs *= 2;
      }
    }

    return null;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const encoded = encodeURIComponent(key);
    const result = await this.request<string>(`/get/${encoded}`);
    if (typeof result !== 'string') return null;
    try {
      return JSON.parse(result) as T;
    } catch {
      return null;
    }
  }

  async set<T = unknown>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const encodedKey = encodeURIComponent(key);
    const encodedValue = encodeURIComponent(JSON.stringify(value));
    await this.request(`/set/${encodedKey}/${encodedValue}/EX/${Math.max(1, ttlSeconds)}`);
  }

  async del(key: string): Promise<void> {
    const encoded = encodeURIComponent(key);
    await this.request(`/del/${encoded}`);
  }

  async wrap<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const computed = await fn();
    await this.set(key, computed, ttlSeconds);
    return computed;
  }
}

class GenericRedisCacheStore implements CacheStore {
  private constructor(private readonly client: any) {}

  static async fromRedisUrl(redisUrl: string): Promise<GenericRedisCacheStore | null> {
    try {
      const redisModule = (await import('redis')) as {
        createClient: (opts: { url: string }) => any;
      };

      const client = redisModule.createClient({ url: redisUrl });
      client.on('error', () => {
        // swallow and fallback logic handled by caller
      });
      if (!client.isOpen) {
        await client.connect();
      }
      return new GenericRedisCacheStore(client);
    } catch {
      return null;
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async set<T = unknown>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), {
      EX: Math.max(1, ttlSeconds),
    });
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async wrap<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const computed = await fn();
    await this.set(key, computed, ttlSeconds);
    return computed;
  }
}

let cacheSingleton: Promise<CacheStore> | null = null;

async function buildCacheStore(): Promise<CacheStore> {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    return new UpstashRestCacheStore(upstashUrl.replace(/\/$/, ''), upstashToken);
  }

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const redisStore = await GenericRedisCacheStore.fromRedisUrl(redisUrl);
    if (redisStore) return redisStore;
  }

  return new MemoryCacheStore();
}

export async function getCacheStore(): Promise<CacheStore> {
  if (!cacheSingleton) {
    cacheSingleton = buildCacheStore();
  }
  return cacheSingleton;
}

export async function clearCacheKeys(keys: string[]): Promise<void> {
  const cache = await getCacheStore();
  await Promise.all(keys.map((key) => cache.del(key)));
}

export async function resetCacheStore(): Promise<void> {
  cacheSingleton = null;
}
