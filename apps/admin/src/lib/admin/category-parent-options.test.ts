import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { CategoryTreeNode } from '@/lib/api/categories'
import {
  categoryParentOptions,
  flattenCategoryTree,
  subtreeHeight,
} from './category-parent-options'

function cat(id: string, children: CategoryTreeNode[] = []): CategoryTreeNode {
  return { id, name: id, slug: id, parentId: null, children }
}

// Women > Kameez > Single Kameez, plus a flat Men.
const KIDS = cat('single')
const KAMEEZ = cat('kameez', [KIDS])
const WOMEN = cat('women', [KAMEEZ])
const MEN = cat('men')
const ROWS = flattenCategoryTree([WOMEN, MEN])

describe('flattenCategoryTree', () => {
  it('renders children under their parent with the full URL path', () => {
    assert.deepEqual(
      ROWS.map((r) => `${r.depth}:${r.path}`),
      ['0:/women', '1:/women/kameez', '2:/women/kameez/single', '0:/men'],
    )
  })
})

describe('subtreeHeight', () => {
  it('counts the node itself', () => {
    assert.equal(subtreeHeight(MEN), 1)
    assert.equal(subtreeHeight(WOMEN), 3)
  })
})

describe('categoryParentOptions', () => {
  it('offers the first two levels when creating', () => {
    assert.deepEqual(
      categoryParentOptions(ROWS, null).map((r) => r.node.id),
      ['women', 'kameez', 'men'],
    )
  })

  it('never offers the category itself or one of its descendants', () => {
    // Kameez under Single Kameez is the cycle the API rejects.
    assert.deepEqual(
      categoryParentOptions(ROWS, KAMEEZ).map((r) => r.node.id),
      ['women', 'men'],
    )
  })

  it('refuses a parent that would push the branch past three levels', () => {
    // Women is three levels tall, so it can only live at the top.
    assert.deepEqual(categoryParentOptions(ROWS, WOMEN).map((r) => r.node.id), [])
  })

  it('lets a leaf move to the third level', () => {
    assert.deepEqual(
      categoryParentOptions(ROWS, MEN).map((r) => r.node.id),
      ['women', 'kameez'],
    )
  })
})
