import { isJhingephoolCollectionSlug, isSareeCategorySlug } from '@splaro/types'

describe('jhingephool collection rules', () => {
  it('matches the canonical slug only', () => {
    expect(isJhingephoolCollectionSlug('jhingephool')).toBe(true)
    expect(isJhingephoolCollectionSlug('Jhingephool')).toBe(true)
    expect(isJhingephoolCollectionSlug('women')).toBe(false)
  })

  it('treats saree category slugs as saree', () => {
    expect(isSareeCategorySlug('sarees')).toBe(true)
    expect(isSareeCategorySlug('cotton-saree')).toBe(true)
    expect(isSareeCategorySlug('panjabi')).toBe(false)
  })
})
