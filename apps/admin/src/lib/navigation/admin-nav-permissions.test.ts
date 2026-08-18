import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { canAccessNavRoute, canRoleAccessAdminHref } from './admin-nav-permissions'

describe('admin nav role visibility', () => {
  it('hides settings from Editor even if coarse settings permission exists', () => {
    assert.equal(
      canAccessNavRoute('/dashboard/settings', {
        role: 'STAFF',
        permissions: ['settings:view'],
      }),
      false,
    )
  })

  it('hides security from Manager', () => {
    assert.equal(
      canRoleAccessAdminHref('/dashboard/admin-users', 'MANAGER'),
      false,
    )
  })

  it('keeps finance visible for Admin', () => {
    assert.equal(
      canAccessNavRoute('/dashboard/finance/expenses', {
        role: 'ADMIN',
        permissions: ['finance:view'],
      }),
      true,
    )
  })
})
