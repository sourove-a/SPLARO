import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mergeBrandingDraft } from './branding-hydrate'

describe('mergeBrandingDraft', () => {
  it('fills empty branding favicon from store', () => {
    const merged = mergeBrandingDraft(
      { logo: '', favicon: '', storeImage: '', storeLabel: 'Store', footerTagline: '', footerCopyright: '' },
      { favicon: '/images/logo/splaro-logo-black-premium.webp' },
    )
    assert.equal(merged.favicon, '/images/logo/splaro-logo-black-premium.webp')
  })

  it('keeps branding favicon when both are set', () => {
    const merged = mergeBrandingDraft(
      { favicon: '/brand.ico' },
      { favicon: '/store.ico' },
    )
    assert.equal(merged.favicon, '/brand.ico')
  })
})
