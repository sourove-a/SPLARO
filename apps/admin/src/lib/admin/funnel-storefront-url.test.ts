import { test } from 'node:test'
import assert from 'node:assert/strict'

import { getStorefrontOrigin } from '../storefront-origin'
import { funnelStorefrontUrl } from './funnel-storefront-url'

test('funnelStorefrontUrl produces valid storefront URL on server and browser', () => {
  // Test server fallback
  const serverUrl = funnelStorefrontUrl('lifestyle')
  assert.ok(serverUrl.includes('/funnel/drop?drop=lifestyle'), 'must contain drop path and slug')
  assert.ok(!serverUrl.includes('undefined'), 'must not contain undefined')

  // Test browser at admin.splaro.co
  const originalWindow = globalThis.window
  try {
    globalThis.window = {
      location: { hostname: 'admin.splaro.co' } as unknown as Location,
    } as unknown as Window & typeof globalThis
    assert.equal(getStorefrontOrigin(), 'https://splaro.co')
    assert.equal(funnelStorefrontUrl('lifestyle'), 'https://splaro.co/funnel/drop?drop=lifestyle')
    assert.equal(funnelStorefrontUrl('tipor shoes'), 'https://splaro.co/funnel/drop?drop=tipor%20shoes')

    // Test browser at local 127.0.0.1
    globalThis.window = {
      location: { hostname: '127.0.0.1' } as unknown as Location,
    } as unknown as Window & typeof globalThis
    assert.equal(getStorefrontOrigin(), 'http://127.0.0.1:3000')
    assert.equal(funnelStorefrontUrl('lifestyle'), 'http://127.0.0.1:3000/funnel/drop?drop=lifestyle')

    // Test browser at local localhost
    globalThis.window = {
      location: { hostname: 'localhost' } as unknown as Location,
    } as unknown as Window & typeof globalThis
    assert.equal(getStorefrontOrigin(), 'http://localhost:3000')
    assert.equal(funnelStorefrontUrl('lifestyle'), 'http://localhost:3000/funnel/drop?drop=lifestyle')
  } finally {
    globalThis.window = originalWindow
  }
})
