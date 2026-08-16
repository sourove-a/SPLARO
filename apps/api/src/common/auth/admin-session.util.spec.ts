import { isPublicApiPath } from './admin-session.util'

/**
 * `isPublicApiPath` is the single place that decides whether AdminAuthGuard is
 * skipped entirely. A prefix that is too broad silently un-authenticates every
 * route underneath it, so the allowlist is pinned here.
 */
describe('isPublicApiPath', () => {
  const publicPaths: [string, string][] = [
    ['/api/v1/health', 'GET'],
    ['/api/v1/storefront/products', 'GET'],
    ['/api/v1/storefront/orders', 'POST'],
    ['/api/v1/telegram-webhook', 'POST'],
    ['/api/v1/webhooks/steadfast', 'POST'],
    ['/api/v1/mobile/auth/login', 'POST'],
    ['/api/v1/admin/auth/login', 'POST'],
    ['/api/v1/search', 'GET'],
    ['/api/v1/realtime/orders/SPL-1001', 'GET'],
  ]

  it.each(publicPaths)('treats %s %s as public', (path, method) => {
    expect(isPublicApiPath(path, method)).toBe(true)
  })

  const guardedPaths: [string, string][] = [
    // Merchant-side money movement must never inherit the storefront's public trust.
    ['/api/v1/payments/bkash/refund', 'POST'],
    ['/api/v1/admin/orders', 'GET'],
    ['/api/v1/admin/products', 'POST'],
    ['/api/v1/admin/security/staff', 'GET'],
    ['/api/v1/health/database', 'GET'],
    ['/api/v1/realtime/admin/orders', 'GET'],
    ['/api/v1/telegram/confirm-order', 'POST'],
    ['/api/v1/admin/auth/login', 'GET'],
    ['/api/v1/commerce-os/wms/movements', 'POST'],
    ['/api/v1/partners', 'GET'],
  ]

  it.each(guardedPaths)('keeps %s %s behind the guard', (path, method) => {
    expect(isPublicApiPath(path, method)).toBe(false)
  })

  it('does not let a lookalike prefix escape the guard', () => {
    expect(isPublicApiPath('/api/v1/storefronts-admin/secrets', 'GET')).toBe(false)
    expect(isPublicApiPath('/api/v1/healthz', 'GET')).toBe(false)
  })

  it('keeps customer payment callbacks reachable without a session', () => {
    // These carry their own @Public() decorator, which the guard checks before
    // this helper — assert the helper no longer blanket-opens the controller.
    expect(isPublicApiPath('/api/v1/payments/ssl/ipn', 'POST')).toBe(false)
  })
})
