import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  canAttemptChunkReload,
  isRecoverableNavigationError,
  shouldHardNavigateAfterTimeout,
  shouldSilentFullPageReload,
} from './navigation-recovery.ts'

describe('navigation-recovery', () => {
  it('treats chunk and RSC failures as recoverable', () => {
    assert.equal(isRecoverableNavigationError(new Error('ChunkLoadError')), true)
    assert.equal(isRecoverableNavigationError('Loading chunk 123 failed'), true)
    assert.equal(isRecoverableNavigationError('Failed to fetch dynamically imported module'), true)
    assert.equal(isRecoverableNavigationError('Failed to fetch'), true)
  })

  it('does not treat unrelated errors as recoverable', () => {
    assert.equal(isRecoverableNavigationError(new Error('Invalid phone number')), false)
  })

  it('hard-navigates on timeout even when the URL already matches', () => {
    assert.equal(
      shouldHardNavigateAfterTimeout({ settled: false, urlMatches: true }),
      true,
    )
    assert.equal(
      shouldHardNavigateAfterTimeout({ settled: true, urlMatches: true }),
      false,
    )
  })

  it('stops silent chunk reloads after the max', () => {
    assert.equal(canAttemptChunkReload(0, 2), true)
    assert.equal(canAttemptChunkReload(1, 2), true)
    assert.equal(canAttemptChunkReload(2, 2), false)
  })

  it('does not full-page reload on generic network failures', () => {
    assert.equal(shouldSilentFullPageReload({ message: 'Failed to fetch' }), false)
    assert.equal(shouldSilentFullPageReload({ message: 'invalid response' }), false)
    assert.equal(shouldSilentFullPageReload({ message: 'application-error' }), false)
    assert.equal(shouldSilentFullPageReload({ message: 'Load failed' }), false)
  })

  it('full-page reloads only for Next static chunk failures', () => {
    assert.equal(shouldSilentFullPageReload({ message: 'ChunkLoadError' }), true)
    assert.equal(
      shouldSilentFullPageReload({ message: 'Failed to fetch dynamically imported module' }),
      true,
    )
    assert.equal(
      shouldSilentFullPageReload({ assetUrl: 'https://splaro.co/_next/static/chunks/app.js' }),
      true,
    )
  })
})
