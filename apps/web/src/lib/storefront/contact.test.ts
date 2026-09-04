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

  it('uses the warm order-inquiry default message when none is supplied', () => {
    const url = whatsAppHref('+8801905010205')
    assert.equal(
      url,
      'https://wa.me/8801905010205?text=Hi%20SPLARO!%20I\'m%20interested%20in%20ordering%2C%20can%20you%20help%20me%3F'
    )
  })
})
