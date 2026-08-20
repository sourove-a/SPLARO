import {
  buildProductMetaDescription,
  buildProductMetaTitle,
  collapseDuplicateAdjacentWords,
  isStaleProductMeta,
} from './seo-meta.util'

describe('seo-meta.util', () => {
  it('collapses adjacent Premium premium', () => {
    expect(collapseDuplicateAdjacentWords('Premium premium cotton polo')).toBe('Premium cotton polo')
  })

  it('does not add premium twice when the product name already has it', () => {
    const desc = buildProductMetaDescription('Premium Cotton Polo')
    expect(desc.toLowerCase()).not.toMatch(/premium\s+premium/)
    expect(desc).toContain('Premium Cotton Polo')
    expect(desc).toMatch(/men, women and kids/)
  })

  it('flags empty and stale duplicate meta', () => {
    expect(isStaleProductMeta('')).toBe(true)
    expect(isStaleProductMeta('Premium premium piece from SPLARO.')).toBe(true)
    expect(isStaleProductMeta('Shop the Pink Printed Cotton Saree at SPLARO — fashion for men, women and kids in Bangladesh.')).toBe(
      false,
    )
  })

  it('keeps titles within 60 characters', () => {
    expect(buildProductMetaTitle('Pink Printed Cotton Saree').length).toBeLessThanOrEqual(60)
  })
})
