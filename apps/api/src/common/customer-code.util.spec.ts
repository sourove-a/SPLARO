import {
  formatSplCustomerCode,
  isSplCustomerCode,
  parseSplCustomerNumber,
} from '@splaro/config'

describe('customer-code config', () => {
  it('formats six-digit padded codes', () => {
    expect(formatSplCustomerCode(1)).toBe('SPL-C-000001')
    expect(formatSplCustomerCode(18542)).toBe('SPL-C-018542')
  })

  it('parses SPL-C codes case-insensitively', () => {
    expect(parseSplCustomerNumber('spl-c-000127')).toBe(127)
    expect(isSplCustomerCode('SPL-C-000001')).toBe(true)
    expect(isSplCustomerCode('cmsohwcxm000ms9rwisnj6b2y')).toBe(false)
  })
})
