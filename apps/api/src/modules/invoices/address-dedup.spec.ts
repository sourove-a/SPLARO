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

  it('collapses an address that was submitted twice, joined without a comma', () => {
    // Reported from a real order: two addresses concatenated, so the join fell
    // inside a token ("Bangladesh House 84") and defeated deduplication.
    const raw =
      'House 84, Road 12, Sector 13, Uttara, Dhaka 1230, Bangladesh House 84, Bangladesh, Bangshal, Dhaka'
    const out = formatCleanAddress(raw)
    expect(out).not.toContain('Bangladesh House 84')
    // "House 84" is kept once, at its original position.
    expect(out.match(/House 84/g)).toHaveLength(1)
    expect(out).toBe('House 84, Road 12, Sector 13, Uttara, Dhaka 1230, Bangladesh, Bangshal, Dhaka')
  })

  it('collapses a clean double submission of the same address', () => {
    const one = 'House 84, Road 12, Sector 13, Uttara, Dhaka 1230, Bangladesh'
    expect(formatCleanAddress(`${one}, ${one}`)).toBe(one)
    expect(formatCleanAddress(one, one)).toBe(one)
  })

  it('collapses a double submission joined with no separator at all', () => {
    const one = 'House 84, Road 12, Sector 13, Uttara, Dhaka 1230, Bangladesh'
    // "…BangladeshHouse 84…" — the two copies share a word, so there is no
    // whitespace to split on.
    expect(formatCleanAddress(one + one)).toBe(one)
    expect(formatCleanAddress(`${one} ${one}`)).toBe(one)
    expect(formatCleanAddress(`${one}\n${one}`)).toBe(one)
  })

  it('collapses a no-comma address that was typed twice', () => {
    expect(formatCleanAddress('paik para ullapara sirajganj paik para ullapara sirajganj')).toBe(
      'paik para ullapara sirajganj',
    )
  })

  it('does not split a word that merely ends with the first token', () => {
    // Without the case-boundary guard, "Broad 12" would be cut into "B" + "road 12".
    expect(formatCleanAddress('Road 12, Broad 12, Dhaka')).toBe('Road 12, Broad 12, Dhaka')
    expect(formatCleanAddress('House 84, Newhouse 84, Dhaka')).toBe('House 84, Newhouse 84, Dhaka')
  })

  it('keeps a house number that merely repeats a word, rather than over-splitting', () => {
    // "Dhaka" appears earlier, but "Dhaka 1230" is one place, not two.
    expect(formatCleanAddress('Dhaka, Road 3, Dhaka 1230')).toBe('Dhaka, Road 3, Dhaka 1230')
  })

  it('handles Bengali (Bangla) addresses accurately', () => {
    expect(formatCleanAddress('বাড়ি ১২, রোড ৪, ধানমন্ডি', 'ঢাকা', 'ঢাকা')).toBe(
      'বাড়ি ১২, রোড ৪, ধানমন্ডি, ঢাকা',
    )
  })
})
