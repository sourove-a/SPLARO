import { internalSecretMatches } from './internal-secret.util'

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
