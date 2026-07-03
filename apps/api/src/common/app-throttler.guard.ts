import { Injectable, ExecutionContext } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

/**
 * Storefront stays rate-limited; authenticated admin routes skip throttle (panel makes many
 * parallel reads). Admin AUTH routes must never skip — they are unauthenticated and
 * brute-forceable, so per-route @Throttle limits apply there.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ url?: string; path?: string; originalUrl?: string }>()
    const path = req.originalUrl ?? req.url ?? req.path ?? ''
    if (/\/admin\/auth(\/|$|\?)/.test(path)) return super.shouldSkip(context)
    if (/\/admin(\/|$|\?)/.test(path)) return true
    return super.shouldSkip(context)
  }
}
