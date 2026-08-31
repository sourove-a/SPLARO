import {
  classifyCustomerQuery,
  isCompleteBdMobile,
  looksLikeCustomerLookup,
} from './telegram-customer-search'

describe('classifyCustomerQuery', () => {
  it('reads a whole BD mobile in every shape it is written', () => {
    for (const written of ['01712345678', '+8801712345678', '8801712345678', '017 1234 5678', '01712-345678']) {
      const q = classifyCustomerQuery(written)
      expect(q.kind).toBe('phone')
      // The last ten digits are what match across the 0 / 88 / +88 prefixes.
      expect(q.digits10).toBe('1712345678')
    }
  })

  it('accepts the fragment someone actually remembers', () => {
    const q = classifyCustomerQuery('5678')
    expect(q).toMatchObject({ kind: 'phone', term: '5678', digits10: '5678' })
  })

  it('refuses a fragment short enough to return the whole shop', () => {
    expect(classifyCustomerQuery('12').kind).toBe('tooShort')
    expect(classifyCustomerQuery('').kind).toBe('tooShort')
    expect(classifyCustomerQuery('   ').kind).toBe('tooShort')
  })

  it('tells an email from a name', () => {
    expect(classifyCustomerQuery('Rahim@Example.COM')).toEqual({
      kind: 'email',
      term: 'rahim@example.com',
    })
    expect(classifyCustomerQuery('Rahim Uddin').kind).toBe('name')
  })

  it('tells a customer code from a name that happens to have digits', () => {
    expect(classifyCustomerQuery('cus-00123')).toEqual({ kind: 'code', term: 'CUS-00123' })
    expect(classifyCustomerQuery('SPL0042')).toEqual({ kind: 'code', term: 'SPL0042' })
    // A name is still a name.
    expect(classifyCustomerQuery('Abdul Karim').kind).toBe('name')
  })

  it('keeps a Bangla name searchable', () => {
    const q = classifyCustomerQuery('রহিম')
    expect(q).toEqual({ kind: 'name', term: 'রহিম' })
  })
})

describe('isCompleteBdMobile', () => {
  it('is true only for a full number', () => {
    expect(isCompleteBdMobile('01712345678')).toBe(true)
    expect(isCompleteBdMobile('+8801712345678')).toBe(true)
    expect(isCompleteBdMobile('1712345678')).toBe(false)
    expect(isCompleteBdMobile('0171234567')).toBe(false)
  })
})

describe('looksLikeCustomerLookup', () => {
  it('claims a run of digits', () => {
    expect(looksLikeCustomerLookup('01712345678')).toBe(true)
    expect(looksLikeCustomerLookup('+880 1712 345678')).toBe(true)
    expect(looksLikeCustomerLookup('5678')).toBe(true)
  })

  it('leaves the AI assistant its sentences', () => {
    // Stealing free text for a name search is how the assistant stops working.
    expect(looksLikeCustomerLookup('how many orders today')).toBe(false)
    expect(looksLikeCustomerLookup('Rahim Uddin')).toBe(false)
    expect(looksLikeCustomerLookup('show me 5 orders')).toBe(false)
    expect(looksLikeCustomerLookup('12')).toBe(false)
    expect(looksLikeCustomerLookup('')).toBe(false)
  })
})
