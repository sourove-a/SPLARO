import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  canEditAdminProfile,
  formatAdminDisplayName,
} from './role-label'

describe('formatAdminDisplayName', () => {
  it('keeps owner placeholder as splaro', () => {
    assert.equal(formatAdminDisplayName('SPLARO CEO', 'splaro.bd@gmail.com'), 'splaro')
  })

  it('shows a saved owner name', () => {
    assert.equal(formatAdminDisplayName('Sourove Ahmed', 'splaro.bd@gmail.com'), 'Sourove Ahmed')
  })

  it('leaves staff names unchanged', () => {
    assert.equal(formatAdminDisplayName('Amina Rahman', 'editor@splaro.co'), 'Amina Rahman')
  })
})

describe('canEditAdminProfile', () => {
  it('allows admin, editor, manager, and owner staff', () => {
    assert.equal(canEditAdminProfile('ADMIN'), true)
    assert.equal(canEditAdminProfile('STAFF'), true)
    assert.equal(canEditAdminProfile('MANAGER'), true)
    assert.equal(canEditAdminProfile('SUPER_ADMIN'), true)
  })

  it('blocks viewer', () => {
    assert.equal(canEditAdminProfile('VIEWER'), false)
  })
})
