import { resolveRoutePermission } from './admin-route-permissions.util'
import { staffHasPermission } from '../../modules/security/security-permissions.util'

describe('resolveRoutePermission unmapped writes', () => {
  it('maps agent, automation, and telegram confirm onto the orders matrix', () => {
    expect(resolveRoutePermission('/api/v1/agent/chat', 'POST')).toEqual({
      moduleSlug: 'orders',
      action: 'create',
    })
    expect(resolveRoutePermission('automation/trigger', 'POST')).toEqual({
      moduleSlug: 'orders',
      action: 'create',
    })
    expect(resolveRoutePermission('telegram/confirm-order', 'POST')).toEqual({
      moduleSlug: 'orders',
      action: 'create',
    })
  })

  it('maps google-sheets and the product agent onto settings', () => {
    expect(resolveRoutePermission('google-sheets/sync-all', 'POST')).toEqual({
      moduleSlug: 'settings',
      action: 'create',
    })
    expect(resolveRoutePermission('ai-product-agent/generate', 'POST')).toEqual({
      moduleSlug: 'settings',
      action: 'create',
    })
  })

  it('still skips the staff-self Telegram link path', () => {
    expect(resolveRoutePermission('admin/security/staff/me/telegram-link-token', 'POST')).toBeNull()
  })

  it('forbids STAFF from POST /automation/trigger', () => {
    const route = resolveRoutePermission('automation/trigger', 'POST')
    expect(route).not.toBeNull()
    expect(
      staffHasPermission('STAFF', undefined, route!.moduleSlug, route!.action),
    ).toBe(false)
  })
})
