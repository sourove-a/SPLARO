import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { departmentSelectionFor, needsDepartmentHydration } from './category-hydrate'

/** Women → Saree → Jamdani, plus a category filed straight under a department. */
const CATEGORIES = [
  { id: 'women', parentId: null },
  { id: 'saree', parentId: 'women' },
  { id: 'jamdani', parentId: 'saree' },
  { id: 'bags', parentId: 'women' },
  { id: 'orphan', parentId: 'gone' },
]
const departmentFor = (id: string) =>
  ({ women: 'women', saree: 'women', jamdani: 'women', bags: 'women', orphan: '' })[id] ?? ''

describe('departmentSelectionFor', () => {
  it('opens both levels above a leaf category', () => {
    assert.deepEqual(departmentSelectionFor('jamdani', CATEGORIES, departmentFor), {
      departmentId: 'women',
      subDepartmentId: 'saree',
    })
  })

  it('leaves the third select closed for a category filed under its department', () => {
    // `bags` hangs straight off `women`, so there is no middle level to show.
    assert.deepEqual(departmentSelectionFor('bags', CATEGORIES, departmentFor), {
      departmentId: 'women',
      subDepartmentId: '',
    })
  })

  it('does not treat a department as its own sub-department', () => {
    assert.deepEqual(departmentSelectionFor('women', CATEGORIES, departmentFor), {
      departmentId: 'women',
      subDepartmentId: '',
    })
  })

  it('survives a category whose parent is missing, and an empty id', () => {
    assert.deepEqual(departmentSelectionFor('orphan', CATEGORIES, departmentFor), {
      departmentId: '',
      subDepartmentId: 'gone',
    })
    assert.deepEqual(departmentSelectionFor('', CATEGORIES, departmentFor), {
      departmentId: '',
      subDepartmentId: '',
    })
    assert.deepEqual(departmentSelectionFor('unknown', CATEGORIES, departmentFor), {
      departmentId: '',
      subDepartmentId: '',
    })
  })
})

describe('needsDepartmentHydration', () => {
  it('fills the selects in once the product and the category list are both there', () => {
    assert.equal(needsDepartmentHydration('jamdani', 12, ''), true)
  })

  it('stops as soon as a department is set', () => {
    // This is what keeps the operator's own choice: re-deriving after they have
    // picked would close the level they just opened, which is the bug that made
    // the category impossible to change.
    assert.equal(needsDepartmentHydration('jamdani', 12, 'women'), false)
  })

  it('waits for the category list rather than deriving from nothing', () => {
    assert.equal(needsDepartmentHydration('jamdani', 0, ''), false)
  })

  it('has nothing to open for a product with no category', () => {
    assert.equal(needsDepartmentHydration('', 12, ''), false)
  })
})
