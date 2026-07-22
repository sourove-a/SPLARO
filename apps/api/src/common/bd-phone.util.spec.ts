import {
  bdPhoneLookupVariants,
  isValidBdMobile,
  normalizeBdPhone,
} from './bd-phone.util'

describe('bd-phone.util', () => {
  it('normalizes +880, 880, and bare 10-digit to local 01…', () => {
    expect(normalizeBdPhone('+8801717112520')).toBe('01717112520')
    expect(normalizeBdPhone('8801717112520')).toBe('01717112520')
    expect(normalizeBdPhone('01717112520')).toBe('01717112520')
    expect(normalizeBdPhone('1717112520')).toBe('01717112520')
    expect(normalizeBdPhone('01717-112-520')).toBe('01717112520')
  })

  it('accepts valid BD mobiles only', () => {
    expect(isValidBdMobile('01717112520')).toBe(true)
    expect(isValidBdMobile('+8801717112520')).toBe(true)
    expect(isValidBdMobile('01117112520')).toBe(false)
    expect(isValidBdMobile('017171125')).toBe(false)
  })

  it('returns 01 and 880 lookup variants', () => {
    expect(bdPhoneLookupVariants('01717112520')).toEqual([
      '01717112520',
      '8801717112520',
      '1717112520',
    ])
    expect(bdPhoneLookupVariants('+8801717112520')).toEqual([
      '01717112520',
      '8801717112520',
      '1717112520',
    ])
  })
})
