import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { whatsAppHref } from './contact'

describe('whatsAppHref', () => {
  it('normalizes a Bangladeshi local number to the international format', () => {
    assert.match(whatsAppHref('01905-010205', 'Confirm'), /^https:\/\/wa\.me\/8801905010205\?text=/)
  })

  it('keeps an already international number unchanged', () => {
    assert.match(whatsAppHref('+8801905010205', 'Confirm'), /^https:\/\/wa\.me\/8801905010205\?text=/)
  })
})
