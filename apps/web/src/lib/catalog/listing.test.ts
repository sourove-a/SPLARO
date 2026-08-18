import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildScopedListingAttempts } from './listing.ts'

describe('buildScopedListingAttempts', () => {
  it('loads /c/sarees from the saree category tree only', () => {
    const attempts = buildScopedListingAttempts({
      parentCategorySlug: 'sarees',
      collectionSlug: 'sarees',
    })
    assert.deepEqual(attempts, [{ parentCategorySlug: 'sarees' }])
  })

  it('loads ঝিঙেফুল from the collection only — never as a category', () => {
    const attempts = buildScopedListingAttempts({ collectionSlug: 'jhingephool' })
    assert.deepEqual(attempts, [{ collectionSlug: 'jhingephool' }])
  })

  it('does not mix category and collection filters', () => {
    const attempts = buildScopedListingAttempts({
      parentCategorySlug: 'sarees',
      collectionSlug: 'jhingephool',
    })
    assert.deepEqual(attempts, [{ parentCategorySlug: 'sarees' }])
  })
})
