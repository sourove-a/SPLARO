import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { locateAndFocusFormError } from './form-error-locator'

describe('form-error-locator', () => {
  it('gracefully handles missing window/document in SSR environments without crashing', () => {
    assert.doesNotThrow(() => {
      locateAndFocusFormError('np-basics', 'Test message', 'np-field-name')
    })
  })
})
