import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { tidyMetaDescription } from './meta-description'

const LIVE_PDP_DESCRIPTION =
  'Onitsuka Tiger Mexico 66 Style Retro Casual Sneakers by SPLARO elevates your fashion wardrobe with refined tailoring and everyday luxury. Premium premiu…'

describe('tidyMetaDescription', () => {
  it('cuts back to the last finished sentence when copy was truncated', () => {
    assert.equal(
      tidyMetaDescription(LIVE_PDP_DESCRIPTION),
      'Onitsuka Tiger Mexico 66 Style Retro Casual Sneakers by SPLARO elevates your fashion wardrobe with refined tailoring and everyday luxury.',
    )
  })

  it('handles a three-dot truncation the same way', () => {
    assert.equal(
      tidyMetaDescription(`${'Soft cotton shirt cut for Dhaka heat, made to wear every day.'} Premium premiu...`),
      'Soft cotton shirt cut for Dhaka heat, made to wear every day.',
    )
  })

  it('drops only the partial word when there is no earlier sentence', () => {
    const noSentence = `${'a'.repeat(100)} incomple…`
    assert.equal(tidyMetaDescription(noSentence), 'a'.repeat(100))
  })

  it('leaves finished copy untouched', () => {
    const clean = 'Hand-finished leather sneakers with a slim rubber outsole, made for everyday wear.'
    assert.equal(tidyMetaDescription(clean), clean)
  })

  it('does not treat a normal sentence ending as truncation', () => {
    const clean = 'Quiet luxury for Bangladesh.'
    assert.equal(tidyMetaDescription(clean), clean)
  })

  it('clamps overlong copy on a word boundary', () => {
    const long = `${'word '.repeat(60)}end`
    const out = tidyMetaDescription(long)
    assert.ok(out.length <= 160)
    assert.ok(!out.endsWith('wor'))
    assert.ok(out.endsWith('word'))
  })

  it('collapses whitespace and survives empty input', () => {
    assert.equal(tidyMetaDescription('  spaced   out  copy.  '), 'spaced out copy.')
    assert.equal(tidyMetaDescription(''), '')
    assert.equal(tidyMetaDescription(null), '')
    assert.equal(tidyMetaDescription(undefined), '')
  })
})
