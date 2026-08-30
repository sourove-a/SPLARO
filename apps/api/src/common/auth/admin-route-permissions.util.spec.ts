import { canRoleAccessAdminPath, resolveRoutePermission } from './admin-route-permissions.util'
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

  it('maps Campaigns onto the settings permission matrix', () => {
    expect(resolveRoutePermission('marketing/campaigns', 'POST')).toEqual({
      moduleSlug: 'settings',
      action: 'create',
    })
    expect(canRoleAccessAdminPath('STAFF', '/api/v1/marketing/campaigns')).toBe(false)
  })

  it('maps Export Center history and log onto orders:view', () => {
    expect(resolveRoutePermission('admin/exports/history', 'GET')).toEqual({
      moduleSlug: 'orders',
      action: 'view',
    })
    expect(resolveRoutePermission('admin/exports/log', 'POST')).toEqual({
      moduleSlug: 'orders',
      action: 'view',
    })
  })

  it('still skips the staff-self Telegram link path', () => {
    expect(resolveRoutePermission('admin/security/staff/me/telegram-link-token', 'POST')).toBeNull()
  })

  it('forbids STAFF from POST /automation/trigger', () => {
    const route = resolveRoutePermission('automation/trigger', 'POST')
    expect(route).not.toBeNull()
    expect(staffHasPermission('STAFF', undefined, route!.moduleSlug, route!.action)).toBe(false)
  })

  it('blocks STAFF and MANAGER from role-hidden admin sections', () => {
    expect(canRoleAccessAdminPath('STAFF', '/api/v1/admin/settings')).toBe(false)
    expect(canRoleAccessAdminPath('MANAGER', '/api/v1/admin/security/staff')).toBe(false)
    expect(canRoleAccessAdminPath('ADMIN', '/api/v1/admin/settings')).toBe(true)
  })
})
