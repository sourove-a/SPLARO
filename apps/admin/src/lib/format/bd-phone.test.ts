import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatBdPhone, telHref } from './bd-phone'

describe('formatBdPhone', () => {
  it('shows the full 11-digit number with no hyphen', () => {
    assert.equal(formatBdPhone('01700000000'), '01700000000')
    assert.equal(formatBdPhone('01700-000000'), '01700000000')
    assert.equal(formatBdPhone('+8801700000000'), '01700000000')
  })

  it('leaves non-BD values untouched', () => {
    assert.equal(formatBdPhone(''), '')
    assert.equal(formatBdPhone('123'), '123')
  })

  it('keeps tel: links international', () => {
    assert.equal(telHref('01700000000'), 'tel:+8801700000000')
  })
})
