import { buildCategoryTree, visibleCategoryRows } from './category-tree.util'

/** Women (hidden) → Kameez (visible) → Single Kameez (visible). */
const ROWS = [
  { id: 'women', parentId: null, isActive: false },
  { id: 'kameez', parentId: 'women', isActive: true },
  { id: 'single', parentId: 'kameez', isActive: true },
  { id: 'men', parentId: null, isActive: true },
  { id: 'polo', parentId: 'men', isActive: false },
  { id: 'polo-slim', parentId: 'polo', isActive: true },
]

describe('visibleCategoryRows', () => {
  it('takes the whole branch down with a hidden parent', () => {
    expect(visibleCategoryRows(ROWS).map((r) => r.id)).toEqual(['men'])
  })

  it('never promotes a hidden branch into a top-level category', () => {
    // The bug this guards: filtering isActive in the query left Kameez with a
    // parent that was not in the set, so the tree made it a root and the
    // storefront rendered the hidden department's children anyway.
    const roots = buildCategoryTree(visibleCategoryRows(ROWS))
    expect(roots.map((r) => r.id)).toEqual(['men'])
  })

  it('keeps a visible row whose parent row is absent entirely', () => {
    const rows = [{ id: 'orphan', parentId: 'gone', isActive: true }]
    expect(visibleCategoryRows(rows).map((r) => r.id)).toEqual(['orphan'])
  })

  it('treats a missing isActive as visible', () => {
    const rows = [{ id: 'a', parentId: null }, { id: 'b', parentId: 'a' }]
    expect(visibleCategoryRows(rows)).toHaveLength(2)
  })

  it('does not hang on a cycle in the data', () => {
    const rows = [
      { id: 'a', parentId: 'b', isActive: true },
      { id: 'b', parentId: 'a', isActive: true },
    ]
    expect(() => visibleCategoryRows(rows)).not.toThrow()
  })
})
