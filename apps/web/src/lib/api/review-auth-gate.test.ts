import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/**
 * The PDP review panel decides between "write a review" and "sign up first".
 *
 * `isLoggedIn` comes from the persisted auth store, which is only trustworthy
 * after SessionHydrator finishes an idle-scheduled /api/auth/me. Before that it
 * reads false even for a signed-in shopper — which is why a customer with an
 * account was still told to sign up. The panel now also asks the server and
 * trusts whichever source says yes.
 *
 * This pins that truth table; the component wires `canWriteReview` the same way.
 */
function canWriteReview(isLoggedIn: boolean, serverSignedIn: boolean | null): boolean {
  return isLoggedIn || serverSignedIn === true
}

describe('review panel auth gate', () => {
  it('shows the form when the store already knows the user', () => {
    assert.equal(canWriteReview(true, null), true)
  })

  it('shows the form when only the server knows — the bug this fixes', () => {
    // Store not hydrated yet, cookie session valid.
    assert.equal(canWriteReview(false, true), true)
  })

  it('shows the sign-up invite for a genuine guest', () => {
    assert.equal(canWriteReview(false, false), false)
  })

  it('shows the sign-up invite while the server answer is still pending', () => {
    // Never flash a form that cannot submit.
    assert.equal(canWriteReview(false, null), false)
  })

  it('keeps the form when the store says yes and the server call failed', () => {
    // A network blip must not log the shopper out of the panel.
    assert.equal(canWriteReview(true, false), true)
  })
})
