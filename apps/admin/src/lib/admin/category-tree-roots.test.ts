import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { categoryTreeRoots } from './category-tree-roots'

describe('categoryTreeRoots', () => {
  it('uses nested tree, not the flat categories list', () => {
    const roots = categoryTreeRoots({
      categories: [
        { id: 'men', name: 'Men', slug: 'men', parentId: null },
        { id: 'polo', name: 'Polo Shirt', slug: 'polo-shirts', parentId: 'men' },
      ],
      tree: [
        {
          id: 'men',
          name: 'Men',
          slug: 'men',
          parentId: null,
          children: [{ id: 'polo', name: 'Polo Shirt', slug: 'polo-shirts', parentId: 'men', children: [] }],
        },
      ],
    })
    assert.equal(roots.length, 1)
    assert.equal(roots[0]?.slug, 'men')
    assert.equal(roots[0]?.children[0]?.slug, 'polo-shirts')
  })

  it('nests leftover flat rows by parentId', () => {
    const roots = categoryTreeRoots({
      categories: [
        { id: 'women', name: 'Women', slug: 'women', parentId: null },
        { id: 'kameez', name: 'Kameez', slug: 'kameez', parentId: 'women' },
      ],
    })
    assert.equal(roots.map((r) => r.slug).join(','), 'women')
    assert.equal(roots[0]?.children[0]?.slug, 'kameez')
  })
})
