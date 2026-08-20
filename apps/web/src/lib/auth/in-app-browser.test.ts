import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  detectInAppBrowser,
  preferGoogleRedirectUx,
} from './in-app-browser'
import { sanitizeGoogleReturnPath } from './google-oauth-return'

describe('detectInAppBrowser', () => {
  it('flags WhatsApp / Telegram / Instagram', () => {
    assert.equal(detectInAppBrowser('Mozilla/5.0 WhatsApp/2.0').inApp, true)
    assert.equal(detectInAppBrowser('Mozilla/5.0 Telegram').kind, 'telegram')
    assert.equal(detectInAppBrowser('Instagram 300.0.0').kind, 'instagram')
  })

  it('flags iOS WKWebView without Safari token', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
    assert.equal(detectInAppBrowser(ua).inApp, true)
  })

  it('allows real iOS Safari', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    assert.equal(detectInAppBrowser(ua).inApp, false)
  })
})

describe('preferGoogleRedirectUx', () => {
  it('prefers redirect on iPhone Safari', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    assert.equal(preferGoogleRedirectUx(ua, 5), true)
  })

  it('prefers redirect on desktop Chrome (popup blanks on gsi/transform)', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    assert.equal(preferGoogleRedirectUx(ua, 0), true)
  })

  it('skips redirect inside in-app browsers (GIS blocked entirely)', () => {
    assert.equal(preferGoogleRedirectUx('Mozilla/5.0 WhatsApp/2.0', 5), false)
  })
})

describe('sanitizeGoogleReturnPath', () => {
  it('rejects open redirects', () => {
    assert.equal(sanitizeGoogleReturnPath('https://evil.test'), '/account')
    assert.equal(sanitizeGoogleReturnPath('//evil.test'), '/account')
    assert.equal(sanitizeGoogleReturnPath('/checkout'), '/checkout')
  })
})
