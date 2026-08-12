import { Injectable, ExecutionContext } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

/**
 * Storefront stays rate-limited; authenticated admin routes skip throttle (panel makes many
 * parallel reads). Admin AUTH routes must never skip — they are unauthenticated and
 * brute-forceable, so per-route @Throttle limits apply there.
 *
 * Tracker prefers X-Real-IP / trusted XFF so BFF→API auth is keyed per shopper, not
 * collapsed onto 127.0.0.1 (site-wide lockout under traffic).
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ url?: string; path?: string; originalUrl?: string }>()
    const path = req.originalUrl ?? req.url ?? req.path ?? ''
    if (/\/admin\/auth(\/|$|\?)/.test(path)) return super.shouldSkip(context)
    if (/\/admin\/dashboard\/presence\/heartbeat(\/|$|\?)/.test(path)) return super.shouldSkip(context)
    if (/\/admin(\/|$|\?)/.test(path)) return true
    return super.shouldSkip(context)
  }

  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = (req['headers'] ?? {}) as Record<string, string | string[] | undefined>
    const realRaw = headers['x-real-ip']
    const realIp = (Array.isArray(realRaw) ? realRaw[0] : realRaw)?.trim()
    if (realIp && isPlausibleIp(realIp)) return realIp

    const xffRaw = headers['x-forwarded-for']
    const xff = Array.isArray(xffRaw) ? xffRaw[0] : xffRaw
    if (typeof xff === 'string' && xff.trim()) {
      const hops = xff
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
      const trustHops = Math.max(1, Number(process.env['TRUST_PROXY_HOPS'] ?? '1') || 1)
      const fromRight = hops[Math.max(0, hops.length - trustHops)]
      if (fromRight && isPlausibleIp(fromRight)) return fromRight
      const last = hops[hops.length - 1]
      if (last && isPlausibleIp(last)) return last
    }

    return super.getTracker(req)
  }
}

function isPlausibleIp(value: string): boolean {
  if (value === 'local' || value === 'unknown') return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return true
  if (value.includes(':') && value.length >= 3 && value.length <= 45) return true
  return false
}
