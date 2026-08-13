import { mergeHomepageCatalog } from '@splaro/config'

describe('homepage-catalog', () => {
  it('defaults to auto rails', () => {
    expect(mergeHomepageCatalog(undefined)).toEqual({ curated: false, tiles: [] })
  })

  it('keeps valid curated tiles and drops incomplete ones', () => {
    const merged = mergeHomepageCatalog({
      curated: true,
      tiles: [
        { id: 'a', department: 'men', categorySlug: 'polo-shirts', productId: 'p1' },
        { department: 'women', categorySlug: '', productId: 'p2' },
        { department: 'kids', categorySlug: 'frocks', productId: 'p3' },
      ],
    })
    expect(merged.curated).toBe(true)
    expect(merged.tiles).toEqual([
      { id: 'a', department: 'men', categorySlug: 'polo-shirts', productId: 'p1' },
      { id: 'tile-kids-frocks-2', department: 'kids', categorySlug: 'frocks', productId: 'p3' },
    ])
  })
})
