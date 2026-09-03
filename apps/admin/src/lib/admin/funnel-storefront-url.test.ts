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
    assert.equal(
      funnelStorefrontUrl({ slug: 'tipor-shoes', subdomain: 'lifestyle' }),
      'https://lifestyle.splaro.co',
    )
    assert.equal(funnelStorefrontUrl('summer-drop'), 'https://splaro.co/funnel/drop?drop=summer-drop')
    assert.equal(
      funnelStorefrontUrl({ slug: 'tipor-shoes', domain: 'exclusivewatch.shop' }),
      'https://exclusivewatch.shop',
    )
    // Single name in domain field without dot is treated as subdomain on splaro.co
    assert.equal(
      funnelStorefrontUrl({ slug: 'tipor-shoes', domain: 'lifestyle' }),
      'https://lifestyle.splaro.co',
    )
    assert.equal(funnelStorefrontUrl({ slug: 'summer-drop' }), 'https://splaro.co/funnel/drop?drop=summer-drop')

    // Test browser at local 127.0.0.1
    globalThis.window = {
      location: { hostname: '127.0.0.1' } as unknown as Location,
    } as unknown as Window & typeof globalThis
    assert.equal(getStorefrontOrigin(), 'http://127.0.0.1:3000')
    assert.equal(
      funnelStorefrontUrl({ slug: 'lifestyle', subdomain: 'lifestyle' }),
      'http://127.0.0.1:3000/funnel/drop?drop=lifestyle',
    )

    // Test browser at local localhost
    globalThis.window = {
      location: { hostname: 'localhost' } as unknown as Location,
    } as unknown as Window & typeof globalThis
    assert.equal(getStorefrontOrigin(), 'http://localhost:3000')
    assert.equal(
      funnelStorefrontUrl({ slug: 'lifestyle', subdomain: 'lifestyle' }),
      'http://localhost:3000/funnel/drop?drop=lifestyle',
    )
  } finally {
    globalThis.window = originalWindow
  }
})
