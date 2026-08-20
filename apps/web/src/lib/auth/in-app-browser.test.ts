import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  detectInAppBrowser,
  preferGoogleRedirectUx,
} from './in-app-browser'
import {
  googleReturnCookieSameSite,
  sanitizeGoogleReturnPath,
} from './google-oauth-return'
import { resolvePostAuthDestination } from './post-auth-destination'
import { isGoogleOAuthOriginEligible } from './google-oauth-origin'
import {
  GOOGLE_CLOUD_JS_ORIGINS,
  GOOGLE_CLOUD_REDIRECT_URIS,
  PRODUCTION_GOOGLE_LOGIN_URI,
  resolveGoogleLoginUri,
} from './google-login-uri'

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

describe('googleReturnCookieSameSite', () => {
  it('uses None+Secure so the cross-site GIS POST still carries the cookie', () => {
    assert.equal(googleReturnCookieSameSite('https:', 'splaro.co'), 'SameSite=None; Secure')
    assert.equal(googleReturnCookieSameSite('https:', 'www.splaro.co'), 'SameSite=None; Secure')
  })

  it('keeps None+Secure on http loopback (Chrome allows Secure there)', () => {
    assert.equal(googleReturnCookieSameSite('http:', '127.0.0.1'), 'SameSite=None; Secure')
    assert.equal(googleReturnCookieSameSite('http:', 'localhost'), 'SameSite=None; Secure')
  })

  it('falls back to Lax where Secure would be rejected outright', () => {
    assert.equal(googleReturnCookieSameSite('http:', 'staging.splaro.test'), 'SameSite=Lax')
  })
})

describe('resolveGoogleLoginUri', () => {
  it('pins splaro.co and www to the Console callback (not localhost)', () => {
    assert.equal(resolveGoogleLoginUri('https://splaro.co'), PRODUCTION_GOOGLE_LOGIN_URI)
    assert.equal(resolveGoogleLoginUri('https://www.splaro.co'), PRODUCTION_GOOGLE_LOGIN_URI)
    assert.equal(PRODUCTION_GOOGLE_LOGIN_URI, 'https://splaro.co/api/auth/google/callback')
  })

  it('canonicalizes localhost to 127.0.0.1 (never send localhost to GIS)', () => {
    assert.equal(
      resolveGoogleLoginUri('http://127.0.0.1:3000'),
      'http://127.0.0.1:3000/api/auth/google/callback',
    )
    assert.equal(
      resolveGoogleLoginUri('http://localhost:3000'),
      'http://127.0.0.1:3000/api/auth/google/callback',
    )
  })

  it('lists Console origins and redirect URIs GIS may send', () => {
    assert.ok(GOOGLE_CLOUD_JS_ORIGINS.includes('https://splaro.co'))
    assert.ok(GOOGLE_CLOUD_REDIRECT_URIS.includes(PRODUCTION_GOOGLE_LOGIN_URI))
    assert.ok(GOOGLE_CLOUD_REDIRECT_URIS.includes('https://splaro.co'))
  })
})

describe('resolvePostAuthDestination', () => {
  it('welcomes a brand-new account, not a returning one', () => {
    assert.equal(
      resolvePostAuthDestination('/account', 'signup'),
      '/account?tab=dashboard&welcome=1',
    )
    assert.equal(resolvePostAuthDestination('/account', 'login'), '/account')
  })

  it('keeps a checkout deep-link ahead of the welcome screen', () => {
    assert.equal(resolvePostAuthDestination('/checkout', 'signup'), '/checkout')
    assert.equal(resolvePostAuthDestination('/checkout?step=2', 'login'), '/checkout?step=2')
  })
})

describe('isGoogleOAuthOriginEligible', () => {
  it('never mounts GIS on 0.0.0.0 — not a trustworthy origin, so the button cannot draw', () => {
    assert.equal(isGoogleOAuthOriginEligible('0.0.0.0'), false)
    assert.equal(isGoogleOAuthOriginEligible('[::]'), false)
  })

  it('allows real hosts', () => {
    assert.equal(isGoogleOAuthOriginEligible('splaro.co'), true)
  })
})
