import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { EventEmitter } from 'events'
import Redis from 'ioredis'

type ChannelHandler = (message: string) => void

const CUSTOMER_MAX_PER_IP = 8
const ADMIN_MAX_PER_SESSION = 4

function redisOptions() {
  return {
    password: process.env['REDIS_PASSWORD'] || undefined,
    db: Number(process.env['REDIS_DB'] ?? '0'),
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    enableOfflineQueue: false,
  } as const
}

@Injectable()
export class RealtimeBusService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeBusService.name)
  private readonly enabled: boolean
  private publisher: Redis | null = null
  private subscriber: Redis | null = null
  private readonly local = new EventEmitter()
  private readonly localSeq = new Map<string, number>()
  private readonly handlers = new Map<string, Set<ChannelHandler>>()
  private readonly customerByIp = new Map<string, number>()
  private readonly adminBySession = new Map<string, number>()
  private activeConnections = 0
  private authFailures = 0
  private publishFailures = 0
  private reconnects = 0

  constructor() {
    this.enabled = process.env['REDIS_ENABLED'] !== 'false'
    this.local.setMaxListeners(200)
    if (this.enabled) {
      void this.connectRedis()
    } else {
      this.logger.warn('Realtime bus using in-process fallback (REDIS_ENABLED=false)')
    }
  }

  get stats() {
    return {
      activeConnections: this.activeConnections,
      authFailures: this.authFailures,
      publishFailures: this.publishFailures,
      reconnects: this.reconnects,
      redis: Boolean(this.publisher && this.subscriber),
    }
  }

  recordAuthFailure(): void {
    this.authFailures += 1
    this.logger.warn('Realtime subscribe denied')
  }

  tryAcquireCustomerSlot(ip: string): boolean {
    const key = ip.trim() || 'unknown'
    const current = this.customerByIp.get(key) ?? 0
    if (current >= CUSTOMER_MAX_PER_IP) return false
    this.customerByIp.set(key, current + 1)
    this.activeConnections += 1
    return true
  }

  releaseCustomerSlot(ip: string): void {
    const key = ip.trim() || 'unknown'
    const current = this.customerByIp.get(key) ?? 0
    if (current <= 1) this.customerByIp.delete(key)
    else this.customerByIp.set(key, current - 1)
    this.activeConnections = Math.max(0, this.activeConnections - 1)
  }

  tryAcquireAdminSlot(sessionId: string): boolean {
    const key = sessionId.trim() || 'unknown'
    const current = this.adminBySession.get(key) ?? 0
    if (current >= ADMIN_MAX_PER_SESSION) return false
    this.adminBySession.set(key, current + 1)
    this.activeConnections += 1
    return true
  }

  releaseAdminSlot(sessionId: string): void {
    const key = sessionId.trim() || 'unknown'
    const current = this.adminBySession.get(key) ?? 0
    if (current <= 1) this.adminBySession.delete(key)
    else this.adminBySession.set(key, current - 1)
    this.activeConnections = Math.max(0, this.activeConnections - 1)
  }

  async nextSeq(orderId: string): Promise<number> {
    if (this.publisher) {
      try {
        const seq = await this.publisher.incr(`splaro:rt:seq:${orderId}`)
        await this.publisher.expire(`splaro:rt:seq:${orderId}`, 60 * 60 * 24 * 30)
        if (seq > 0) return seq
      } catch {
        /* fall through to local seq */
      }
    }
    const next = (this.localSeq.get(orderId) ?? 0) + 1
    this.localSeq.set(orderId, next)
    return next
  }

  async publish(channel: string, payload: string): Promise<void> {
    if (this.publisher) {
      try {
        await this.publisher.publish(channel, payload)
        return
      } catch (err) {
        this.publishFailures += 1
        this.logger.warn(
          `Realtime publish failed (${channel.split(':').slice(0, 3).join(':')}): ${
            err instanceof Error ? err.message : 'error'
          }`,
        )
      }
    }
    this.local.emit(channel, payload)
  }

  subscribe(channel: string, handler: ChannelHandler): () => void {
    let set = this.handlers.get(channel)
    if (!set) {
      set = new Set()
      this.handlers.set(channel, set)
      this.local.on(channel, (message: string) => this.dispatch(channel, message))
      void this.ensureRedisSubscribe(channel)
    }
    const wrapped: ChannelHandler = (message) => {
      try {
        handler(message)
      } catch {
        /* subscriber errors must not break the bus */
      }
    }
    set.add(wrapped)

    return () => {
      const live = this.handlers.get(channel)
      if (!live) return
      live.delete(wrapped)
      if (live.size === 0) {
        this.handlers.delete(channel)
        this.local.removeAllListeners(channel)
        void this.subscriber?.unsubscribe(channel).catch(() => undefined)
      }
    }
  }

  private dispatch(channel: string, message: string): void {
    const set = this.handlers.get(channel)
    if (!set) return
    for (const next of set) next(message)
  }

  private async connectRedis(): Promise<void> {
    const url = process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6379'
    try {
      const publisher = new Redis(url, redisOptions())
      const subscriber = new Redis(url, redisOptions())
      publisher.on('error', (err: Error) => {
        this.logger.debug(`Realtime publisher error: ${err.message}`)
      })
      subscriber.on('error', (err: Error) => {
        this.logger.debug(`Realtime subscriber error: ${err.message}`)
      })
      subscriber.on('message', (channel, message) => {
        this.dispatch(channel, message)
      })
      await publisher.connect()
      await subscriber.connect()
      this.publisher = publisher
      this.subscriber = subscriber
      if (this.handlers.size) {
        await subscriber.subscribe(...this.handlers.keys())
      }
      this.logger.log('Realtime Redis pub/sub ready')
    } catch (err) {
      this.logger.warn(
        `Realtime Redis unavailable — in-process fallback: ${
          err instanceof Error ? err.message : 'connect failed'
        }`,
      )
      this.publisher = null
      this.subscriber = null
    }
  }

  private async ensureRedisSubscribe(channel: string): Promise<void> {
    if (!this.subscriber) return
    try {
      await this.subscriber.subscribe(channel)
    } catch (err) {
      this.reconnects += 1
      this.logger.debug(
        `Realtime subscribe miss: ${err instanceof Error ? err.message : 'error'}`,
      )
    }
  }

  async onModuleDestroy() {
    await this.publisher?.quit().catch(() => undefined)
    await this.subscriber?.quit().catch(() => undefined)
    this.local.removeAllListeners()
  }
}
