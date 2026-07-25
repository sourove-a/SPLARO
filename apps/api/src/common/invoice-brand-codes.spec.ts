import {
  sanitizePublicHostname,
  sanitizeWebsiteDisplay,
  formatSplOrderCode,
  parseSplOrderNumber,
  formatPayCode,
  parsePayNumber,
  isPayCode,
} from '@splaro/config'

describe('invoice brand sanitizer', () => {
  it('rejects localhost / loopback / .local hosts', () => {
    expect(sanitizePublicHostname('http://localhost:3000')).toBeNull()
    expect(sanitizePublicHostname('https://127.0.0.1')).toBeNull()
    expect(sanitizePublicHostname('https://0.0.0.0')).toBeNull()
    expect(sanitizePublicHostname('https://shop.local')).toBeNull()
    expect(sanitizePublicHostname('www.localhost')).toBeNull()
  })

  it('accepts real public hosts and strips www', () => {
    expect(sanitizePublicHostname('https://www.splaro.co')).toBe('splaro.co')
    expect(sanitizePublicHostname('splaro.co')).toBe('splaro.co')
  })

  it('sanitizeWebsiteDisplay never returns www.localhost', () => {
    expect(sanitizeWebsiteDisplay('www.localhost', 'splaro.co')).toBe('www.splaro.co')
    expect(sanitizeWebsiteDisplay('http://127.0.0.1', 'splaro.co')).toBe('www.splaro.co')
    expect(sanitizeWebsiteDisplay('www.splaro.co', 'splaro.co')).toBe('www.splaro.co')
    expect(sanitizeWebsiteDisplay(undefined, 'splaro.co')).toBe('www.splaro.co')
  })
})

describe('order + payment code sequencing', () => {
  it('formats SPL-#### and PAY-####', () => {
    expect(formatSplOrderCode(1001)).toBe('SPL-1001')
    expect(formatPayCode(1001)).toBe('PAY-1001')
  })

  it('parses sequential numbers', () => {
    expect(parseSplOrderNumber('SPL-1042')).toBe(1042)
    expect(parsePayNumber('PAY-1100')).toBe(1100)
  })

  it('isPayCode validates shape', () => {
    expect(isPayCode('PAY-1001')).toBe(true)
    expect(isPayCode('SPL-1001')).toBe(false)
    expect(isPayCode('DEV-1')).toBe(false)
  })
})
