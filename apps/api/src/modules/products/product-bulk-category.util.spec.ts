import { pickCategoryMatch } from './product-bulk-category.util'

const tree = [
  { id: 'bags', name: "Women's Bags", slug: 'bags' },
  { id: 'premium', name: 'Premium', slug: 'bags-premium' },
  { id: 'men-pants', name: 'Pants', slug: 'trousers' },
  { id: 'women-pants', name: 'Pants', slug: 'women-pants' },
  { id: 'shalwar', name: 'Salwar Kameez', slug: 'shalwar-kameez' },
]

describe('pickCategoryMatch', () => {
  it('matches storefront slug so Bags import lands on /accessories?cat=bags', () => {
    expect(pickCategoryMatch(tree, { label: 'bags' })).toEqual({ id: 'bags' })
    expect(pickCategoryMatch(tree, { slug: 'bags' })).toEqual({ id: 'bags' })
    expect(pickCategoryMatch(tree, { label: 'Accessories > bags' })).toEqual({ id: 'bags' })
  })

  it('matches unique names and nested slugs', () => {
    expect(pickCategoryMatch(tree, { label: 'Salwar Kameez' })).toEqual({ id: 'shalwar' })
    expect(pickCategoryMatch(tree, { slug: 'bags-premium' })).toEqual({ id: 'premium' })
  })

  it('requires category_slug when the name exists twice', () => {
    const result = pickCategoryMatch(tree, { label: 'Pants' })
    expect(result).toEqual({
      error: 'Category "Pants" is ambiguous — set category_slug (trousers, women-pants)',
    })
    expect(pickCategoryMatch(tree, { label: 'Pants', slug: 'women-pants' })).toEqual({
      id: 'women-pants',
    })
  })
})
