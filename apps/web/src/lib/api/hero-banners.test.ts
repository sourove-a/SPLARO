import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { heroSlideCopy } from './hero-banners.ts'

describe('heroSlideCopy', () => {
  it('does not invent SPLARO or luxury fallback lines', () => {
    assert.deepEqual(heroSlideCopy({ title: null, subtitle: null, linkUrl: null }), {
      title: '',
      subtitle: '',
      href: '',
    })
  })

  it('keeps merchant copy when it is set', () => {
    assert.deepEqual(
      heroSlideCopy({
        title: 'Elegance That Moves With You.',
        subtitle: 'Premium fashion crafted for timeless everyday luxury.',
        linkUrl: '/shop',
      }),
      {
        title: 'Elegance That Moves With You.',
        subtitle: 'Premium fashion crafted for timeless everyday luxury.',
        href: '/shop',
      },
    )
  })
})
