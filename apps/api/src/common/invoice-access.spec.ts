import { buildInvoiceAccessToken, verifyInvoiceAccessToken } from '@splaro/config'

describe('invoice access token', () => {
  const secret = 'test-invoice-secret'

  it('accepts a valid HMAC key for an invoice number', () => {
    const invoice = 'SPL-1001'
    const key = buildInvoiceAccessToken(invoice, secret)
    expect(verifyInvoiceAccessToken(invoice, key, secret)).toBe(true)
  })

  it('rejects raw invoice number / order id as key (IDOR)', () => {
    expect(verifyInvoiceAccessToken('SPL-1001', 'SPL-1001', secret)).toBe(false)
    expect(verifyInvoiceAccessToken('clxyzorderid', 'clxyzorderid', secret)).toBe(false)
  })

  it('rejects wrong length and tampered keys', () => {
    const invoice = 'SPL-1001'
    const key = buildInvoiceAccessToken(invoice, secret)
    expect(verifyInvoiceAccessToken(invoice, key.slice(0, 8), secret)).toBe(false)
    expect(verifyInvoiceAccessToken(invoice, `${key.slice(0, 11)}0`, secret)).toBe(false)
  })
})
