import { resolveReparentParentSlug } from './category-seed.util'

describe('resolveReparentParentSlug', () => {
  it('maps screenshot leftovers onto the nested tree', () => {
    expect(resolveReparentParentSlug('tote', 'Tote')).toBe('handbags')
    expect(resolveReparentParentSlug('premium', 'Premium')).toBe('bags')
    expect(resolveReparentParentSlug('sunglasses', 'Sunglasses')).toBe('glasses')
    expect(resolveReparentParentSlug('polo-shirt', 'Polo Shirt')).toBe('men')
  })

  it('does not reparent locked departments', () => {
    expect(resolveReparentParentSlug('women', 'Women')).toBeNull()
    expect(resolveReparentParentSlug('men', 'Men')).toBeNull()
    expect(resolveReparentParentSlug('footwear', 'Footwear')).toBeNull()
    expect(resolveReparentParentSlug('kids', 'Kids')).toBeNull()
    expect(resolveReparentParentSlug('accessories', 'Accessories')).toBeNull()
  })

  it('puts women’s bags/shoes in accessories/footwear, not under Women', () => {
    expect(resolveReparentParentSlug('womens-bags', "Women's Bags")).toBe('bags')
    expect(resolveReparentParentSlug('women-shoes', "Women's Shoes")).toBe('footwear')
  })
})
