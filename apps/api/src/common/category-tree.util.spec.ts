import { collectDescendantIds } from './category-tree.util'

describe('collectDescendantIds', () => {
  const flat = [
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
