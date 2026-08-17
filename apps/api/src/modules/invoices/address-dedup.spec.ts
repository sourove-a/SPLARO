import { formatCleanAddress, normalizeAddressToken, splitAddressTokens } from '@splaro/config'

describe('Address Deduplication (formatCleanAddress)', () => {
  it('deduplicates repetitive city / district tokens', () => {
    const raw = 'Natornibash, Uttar RajaBari, Turag Uttara 1230, Uttara, Dhaka, Dhaka, Dhaka'
    expect(formatCleanAddress(raw)).toBe(
      'Natornibash, Uttar RajaBari, Turag Uttara 1230, Uttara, Dhaka',
    )
  })

  it('handles multi-argument combinations without duplicating crumbs', () => {
    const address = 'House 12, Road 4, Sector 7, Uttara'
    const city = 'Uttara'
    const district = 'Dhaka'
    const division = 'Dhaka'
    expect(formatCleanAddress(address, city, district, division)).toBe(
      'House 12, Road 4, Sector 7, Uttara, Dhaka',
    )
  })

  it('normalizes case and trailing punctuation', () => {
    expect(
      formatCleanAddress('Dhanmondi 27, Dhaka.', 'dhaka', 'DHAKA', 'Dhaka District'),
    ).toBe('Dhanmondi 27, Dhaka, Dhaka District')
  })

  it('handles empty, null, and undefined inputs safely', () => {
    expect(formatCleanAddress(null, undefined, '', 'Chittagong', null)).toBe('Chittagong')
    expect(formatCleanAddress()).toBe('')
    expect(formatCleanAddress(null, undefined)).toBe('')
  })

  it('handles multi-line, pipe and semicolon delimited inputs', () => {
    const raw = 'Flat 4B\nHouse 10 | Road 5; Banani'
    expect(formatCleanAddress(raw, 'Dhaka')).toBe('Flat 4B, House 10, Road 5, Banani, Dhaka')
  })

  it('handles Bengali (Bangla) addresses accurately', () => {
    expect(formatCleanAddress('বাড়ি ১২, রোড ৪, ধানমন্ডি', 'ঢাকা', 'ঢাকা')).toBe(
      'বাড়ি ১২, রোড ৪, ধানমন্ডি, ঢাকা',
    )
  })
})
