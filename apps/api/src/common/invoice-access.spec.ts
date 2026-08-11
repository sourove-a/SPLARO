import {
  buildInvoiceAccessToken,
  verifyInvoiceAccessToken,
} from '@splaro/config/invoice-access'

describe('invoice access token', () => {
  const secret = 'test-invoice-secret'

  it('mints a full HMAC hex key (64 chars)', () => {
    const key = buildInvoiceAccessToken('SPL-1001', secret)
    expect(key).toHaveLength(64)
    expect(verifyInvoiceAccessToken('SPL-1001', key, secret)).toBe(true)
  })

  it('accepts legacy 12-char HMAC prefix (compatibility window)', () => {
    const full = buildInvoiceAccessToken('SPL-1001', secret)
    const legacy = full.slice(0, 12)
    expect(verifyInvoiceAccessToken('SPL-1001', legacy, secret)).toBe(true)
  })

  it('rejects raw invoice number / order id as key (IDOR)', () => {
    expect(verifyInvoiceAccessToken('SPL-1001', 'SPL-1001', secret)).toBe(false)
    expect(verifyInvoiceAccessToken('clxyzorderid', 'clxyzorderid', secret)).toBe(false)
  })

  it('rejects wrong length and tampered keys', () => {
    const invoice = 'SPL-1001'
    const key = buildInvoiceAccessToken(invoice, secret)
    expect(verifyInvoiceAccessToken(invoice, key.slice(0, 8), secret)).toBe(false)
    expect(verifyInvoiceAccessToken(invoice, `${key.slice(0, 63)}0`, secret)).toBe(false)
    expect(verifyInvoiceAccessToken(invoice, `${key.slice(0, 11)}0`, secret)).toBe(false)
  })
})
