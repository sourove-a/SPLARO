import { internalSecretMatches, isLoopbackAddress, isLoopbackRequest } from './internal-secret.util'

const SECRET = 'a'.repeat(48)

describe('internalSecretMatches', () => {
  it('accepts the exact secret', () => {
    expect(internalSecretMatches(SECRET, SECRET)).toBe(true)
  })

  it('rejects a wrong value of the same length', () => {
    expect(internalSecretMatches('b'.repeat(48), SECRET)).toBe(false)
  })

  it('rejects a correct prefix — the case a === compare would leak', () => {
    expect(internalSecretMatches(SECRET.slice(0, 47), SECRET)).toBe(false)
    expect(internalSecretMatches(`${SECRET}x`, SECRET)).toBe(false)
  })

  it('never authorises when the secret is unset or blank', () => {
    expect(internalSecretMatches(SECRET, undefined)).toBe(false)
    expect(internalSecretMatches(SECRET, '')).toBe(false)
    expect(internalSecretMatches(SECRET, '   ')).toBe(false)
  })

  it('rejects a missing or empty header', () => {
    expect(internalSecretMatches(undefined, SECRET)).toBe(false)
    expect(internalSecretMatches('', SECRET)).toBe(false)
  })

  it('handles a repeated header without throwing', () => {
    expect(internalSecretMatches([SECRET, 'other'], SECRET)).toBe(true)
    expect(internalSecretMatches(['wrong', SECRET], SECRET)).toBe(false)
  })
})

describe('isLoopbackAddress', () => {
  it('accepts IPv4, IPv6, and IPv6-mapped loopback', () => {
    expect(isLoopbackAddress('127.0.0.1')).toBe(true)
    expect(isLoopbackAddress('::1')).toBe(true)
    expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true)
    expect(isLoopbackAddress('[::1]')).toBe(true)
  })

  it('rejects a public client address', () => {
    expect(isLoopbackAddress('8.8.8.8')).toBe(false)
    expect(isLoopbackAddress('10.0.0.4')).toBe(false)
    expect(isLoopbackAddress(undefined)).toBe(false)
    expect(isLoopbackAddress('')).toBe(false)
  })
})

describe('isLoopbackRequest', () => {
  it('accepts Express req.ip on loopback', () => {
    expect(isLoopbackRequest({ ip: '127.0.0.1' })).toBe(true)
    expect(isLoopbackRequest({ socket: { remoteAddress: '::1' } })).toBe(true)
  })

  it('rejects a forwarded public IP even when nginx is loopback', () => {
    expect(
      isLoopbackRequest({ ip: '203.0.113.10', socket: { remoteAddress: '127.0.0.1' } }),
    ).toBe(false)
    expect(isLoopbackRequest({ ip: '203.0.113.10' })).toBe(false)
  })
})
