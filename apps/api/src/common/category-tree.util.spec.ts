import { buildCategoryTree, collectDescendantIds, pruneEmptyCategoryNodes } from './category-tree.util'

describe('collectDescendantIds', () => {
  const flat = [
    { id: 'women', parentId: null },
    { id: 'salwar', parentId: 'women' },
    { id: 'men', parentId: null },
    { id: 'panjabi', parentId: 'men' },
    { id: 'formal', parentId: 'men' },
    { id: 'footwear', parentId: null },
    { id: 'men-footwear', parentId: 'footwear' },
    { id: 'kids', parentId: null },
    { id: 'boys-wear', parentId: 'kids' },
    { id: 'kids-boys-panjabi', parentId: 'boys-wear' },
  ]

  it('includes root and all depths under men (not men-footwear)', () => {
    expect(collectDescendantIds(flat, 'men').sort()).toEqual(['formal', 'men', 'panjabi'].sort())
  })

  it('does not leak women descendants into /c/men', () => {
    expect(collectDescendantIds(flat, 'men')).not.toContain('salwar')
    expect(collectDescendantIds(flat, 'women').sort()).toEqual(['salwar', 'women'].sort())
  })

  it('keeps men-footwear under footwear only', () => {
    expect(collectDescendantIds(flat, 'footwear').sort()).toEqual(
      ['footwear', 'men-footwear'].sort(),
    )
  })

  it('walks three-level kids tree', () => {
    expect(collectDescendantIds(flat, 'kids').sort()).toEqual(
      ['boys-wear', 'kids', 'kids-boys-panjabi'].sort(),
    )
  })
})

describe('pruneEmptyCategoryNodes', () => {
  it('keeps a parent only when a descendant has products', () => {
    const tree = buildCategoryTree([
      { id: 'women', parentId: null, sortOrder: 0, _count: { products: 0 } },
      { id: 'saree', parentId: 'women', sortOrder: 0, _count: { products: 2 } },
      { id: 'empty', parentId: 'women', sortOrder: 1, _count: { products: 0 } },
    ])
    const pruned = pruneEmptyCategoryNodes(tree)
    expect(pruned.map((n) => n.id)).toEqual(['women'])
    expect(pruned[0]?.children.map((n) => n.id)).toEqual(['saree'])
  })
})
