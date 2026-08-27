import { Injectable, Logger, Optional } from '@nestjs/common'
import { AdminTelegramHubService } from './admin-telegram-hub.service'

export interface ServerErrorReport {
  /** HTTP verb, or a synthetic one like `PROCESS` for a crash outside a request. */
  method: string
  /** Raw request URL, or the source label for a process-level failure. */
  url: string
  statusCode: number
  message: string
  stack?: string
  requestId?: string
}

interface FingerprintState {
  /** Failures seen since the last alert actually went out. */
  suppressed: number
  lastSeenAt: number
  lastAlertAt: number
}

const DEFAULT_WINDOW_MINUTES = 15
const DEFAULT_MAX_PER_HOUR = 12
/** Drop a fingerprint once it has been quiet this long — the map is unbounded otherwise. */
const FORGET_AFTER_MS = 2 * 60 * 60 * 1000
/** Hard ceiling so a wide spread of one-off URLs cannot grow the map without limit. */
const MAX_TRACKED_FINGERPRINTS = 500

function envInt(key: string, fallback: number): number {
  const raw = Number(process.env[key])
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback
}

/**
 * Collapse the ids out of a path so `/orders/clx123.../items` and
 * `/orders/clx999.../items` count as the same failure. Without this every
 * request against a broken route looks new and every one of them alerts.
 */
export function routeFingerprint(url: string): string {
  const path = url.split('?')[0] ?? url
  return (
    path
      .split('/')
      .map((segment) => {
        if (!segment) return segment
        if (/^\d+$/.test(segment)) return ':id'
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
          return ':id'
        }
        // cuid/nanoid-shaped keys, and invoice refs like SPL-10023.
        if (segment.length >= 20 && /^[A-Za-z0-9_-]+$/.test(segment)) return ':id'
        if (/^[A-Z]{2,5}-\d+$/.test(segment)) return ':id'
        return segment
      })
      .join('/') || '/'
  )
}

/** First line only, with the volatile tail (ids, values) trimmed off. */
function messageFingerprint(message: string): string {
  return (message.split('\n')[0] ?? message).slice(0, 120)
}

/** The few frames that point at our own code, not node_modules. */
function ownFrames(stack: string | undefined, limit = 3): string[] {
  if (!stack) return []
  return stack
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('at ') && !line.includes('node_modules'))
    .slice(0, limit)
}

/**
 * Turns 5xx responses and process-level crashes into a Telegram message and an
 * admin tray row, with enough throttling that a broken route pages the shop
 * once rather than once per request. Deliberately in-process and dependency-free
 * — an error burst is exactly when Redis or the database may be the thing that
 * is down.
 */
@Injectable()
export class ServerErrorAlertService {
  private readonly logger = new Logger(ServerErrorAlertService.name)
  private readonly seen = new Map<string, FingerprintState>()
  /** Timestamps of alerts actually sent, for the per-hour ceiling. */
  private sentAt: number[] = []
  private mutedNoticeSentAt = 0

  constructor(@Optional() private readonly hub?: AdminTelegramHubService) {}

  private get enabled(): boolean {
    return process.env['SERVER_ERROR_ALERTS'] !== 'false'
  }

  private get windowMs(): number {
    return envInt('SERVER_ERROR_ALERT_WINDOW_MINUTES', DEFAULT_WINDOW_MINUTES) * 60_000
  }

  private get maxPerHour(): number {
    return envInt('SERVER_ERROR_ALERT_MAX_PER_HOUR', DEFAULT_MAX_PER_HOUR)
  }

  /**
   * Fire-and-forget. Never throws and never rejects: this runs inside the
   * exception filter, so a failure here would replace the real error.
   */
  report(input: ServerErrorReport): void {
    if (!this.enabled || !this.hub) return
    void this.handle(input).catch((error: unknown) => {
      this.logger.error(
        `Server error alert failed: ${error instanceof Error ? error.message : 'unknown'}`,
      )
    })
  }

  private async handle(input: ServerErrorReport): Promise<void> {
    const now = Date.now()
    const route = routeFingerprint(input.url)
    const key = `${input.method} ${route} :: ${messageFingerprint(input.message)}`

    this.prune(now)

    const state = this.seen.get(key) ?? { suppressed: 0, lastSeenAt: now, lastAlertAt: 0 }
    state.lastSeenAt = now

    // Same failure, still inside its window — count it and stay quiet.
    if (state.lastAlertAt && now - state.lastAlertAt < this.windowMs) {
      state.suppressed += 1
      this.seen.set(key, state)
      return
    }

    if (!this.underHourlyCap(now)) {
      state.suppressed += 1
      this.seen.set(key, state)
      await this.sendMutedNotice(now)
      return
    }

    const repeats = state.suppressed
    state.suppressed = 0
    state.lastAlertAt = now
    this.seen.set(key, state)
    this.sentAt.push(now)

    await this.hub?.notifyServerError({
      method: input.method,
      route,
      url: input.url,
      statusCode: input.statusCode,
      message: input.message,
      frames: ownFrames(input.stack),
      ...(input.requestId ? { requestId: input.requestId } : {}),
      repeats,
      windowMinutes: Math.round(this.windowMs / 60_000),
    })
  }

  private underHourlyCap(now: number): boolean {
    this.sentAt = this.sentAt.filter((at) => now - at < 60 * 60_000)
    return this.sentAt.length < this.maxPerHour
  }

  /** One "there are more, go look at the logs" line per hour, not one per error. */
  private async sendMutedNotice(now: number): Promise<void> {
    if (now - this.mutedNoticeSentAt < 60 * 60_000) return
    this.mutedNoticeSentAt = now
    await this.hub?.notifyServerErrorsMuted({
      sentThisHour: this.sentAt.length,
      distinctErrors: this.seen.size,
    })
  }

  private prune(now: number): void {
    for (const [key, state] of this.seen) {
      if (now - state.lastSeenAt > FORGET_AFTER_MS) this.seen.delete(key)
    }
    if (this.seen.size <= MAX_TRACKED_FINGERPRINTS) return
    // Map keeps insertion order and re-setting an existing key does not move it,
    // so iteration order is not recency — sort before evicting.
    const oldestFirst = [...this.seen.entries()].sort(
      (a, b) => a[1].lastSeenAt - b[1].lastSeenAt,
    )
    for (const [key] of oldestFirst.slice(0, this.seen.size - MAX_TRACKED_FINGERPRINTS)) {
      this.seen.delete(key)
    }
  }
}
