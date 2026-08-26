import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  hasUnsavedProductWork,
  productSaveActionLabel,
  productUnsavedLabel,
} from './product-unsaved'

describe('productUnsavedLabel', () => {
  it('names both kinds of pending work at once', () => {
    assert.equal(
      productUnsavedLabel({ dirty: true, variantUnsaved: 3 }),
      'Unsaved changes · 3 variants',
    )
  })

  it('counts a single variant in the singular', () => {
    assert.equal(productUnsavedLabel({ dirty: false, variantUnsaved: 1 }), '1 unsaved variant')
    assert.equal(productUnsavedLabel({ dirty: true, variantUnsaved: 1 }), 'Unsaved changes · 1 variant')
  })

  it('reports field edits with no variant edits', () => {
    assert.equal(productUnsavedLabel({ dirty: true, variantUnsaved: 0 }), 'Unsaved changes')
  })

  it('says everything is saved when nothing is pending', () => {
    assert.equal(productUnsavedLabel({ dirty: false, variantUnsaved: 0 }), 'All changes saved')
  })
})

describe('productSaveActionLabel', () => {
  it('surfaces the variant count, which the head would otherwise hide', () => {
    assert.equal(productSaveActionLabel({ dirty: false, variantUnsaved: 2 }), 'Save · 2 variants')
    assert.equal(productSaveActionLabel({ dirty: true, variantUnsaved: 1 }), 'Save · 1 variant')
  })

  it('marks plain field edits and stays plain when clean', () => {
    assert.equal(productSaveActionLabel({ dirty: true, variantUnsaved: 0 }), 'Save changes •')
    assert.equal(productSaveActionLabel({ dirty: false, variantUnsaved: 0 }), 'Save changes')
  })
})

describe('hasUnsavedProductWork', () => {
  it('is true for either kind of pending edit', () => {
    assert.equal(hasUnsavedProductWork({ dirty: true, variantUnsaved: 0 }), true)
    assert.equal(hasUnsavedProductWork({ dirty: false, variantUnsaved: 1 }), true)
    assert.equal(hasUnsavedProductWork({ dirty: false, variantUnsaved: 0 }), false)
  })
})
