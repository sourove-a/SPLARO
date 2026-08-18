import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { dominantScript, gateScript, scriptWarning } from './bilingual-copy'

/**
 * English and Bangla are stored apart. The English box strips Bengali live.
 * The Bangla box stays editable and only warns when it is mostly English.
 */
describe('script detection', () => {
  it('reads a Bangla sentence as Bangla', () => {
    assert.equal(dominantScript('জামদানি হেরিটেজ শাড়ি'), 'bn')
  })

  it('reads an English sentence as English', () => {
    assert.equal(dominantScript('Jamdani Heritage Saree'), 'en')
  })

  it('stays quiet until there is enough to judge', () => {
    assert.equal(dominantScript('Ja'), null)
    assert.equal(dominantScript('জাম'), null)
    assert.equal(dominantScript(''), null)
  })

  it('keeps a Bangla sentence Bangla when it carries Latin terms', () => {
    assert.equal(dominantScript('ঈদের জন্য প্রিমিয়াম পাঞ্জাবি, COD সুবিধা আছে'), 'bn')
    assert.equal(dominantScript('সাইজ XL, ফ্রি ডেলিভারি ঢাকায়'), 'bn')
  })
})

describe('script gate', () => {
  it('strips Bengali out of an English field as it is typed', () => {
    assert.equal(gateScript('Soft cotton', 'Soft cotton জামদানি', 'en'), 'Soft cotton ')
  })

  it('does not freeze a Bangla field while typing or pasting', () => {
    assert.equal(gateScript('', 'Premium cotton', 'bn'), 'Premium cotton')
    assert.equal(gateScript('', 's', 'bn'), 's')
  })

  it('keeps a Bangla sentence that already has Bengali letters', () => {
    assert.equal(
      gateScript('ঈদের জন্য ', 'ঈদের জন্য প্রিমিয়াম', 'bn'),
      'ঈদের জন্য প্রিমিয়াম',
    )
  })
})

describe('field warnings', () => {
  it('warns in Bangla when the Bangla field holds English', () => {
    const warning = scriptWarning('Jamdani Heritage Saree', 'bn')
    assert.ok(warning)
    assert.match(warning, /বাংলায় লিখুন/)
  })

  it('warns in English when the English field holds Bangla', () => {
    const warning = scriptWarning('জামদানি হেরিটেজ শাড়ি', 'en')
    assert.ok(warning)
    assert.match(warning, /for English/)
  })

  it('says nothing when each field holds its own language', () => {
    assert.equal(scriptWarning('জামদানি হেরিটেজ শাড়ি', 'bn'), null)
    assert.equal(scriptWarning('Jamdani Heritage Saree', 'en'), null)
  })

  it('does not fire on a Bangla line containing a Latin brand or size', () => {
    assert.equal(scriptWarning('সাইজ XL, ফ্রি ডেলিভারি ঢাকায়', 'bn'), null)
  })

  it('does not fire on an empty or barely-started field', () => {
    assert.equal(scriptWarning('', 'bn'), null)
    assert.equal(scriptWarning('Ja', 'bn'), null)
  })
})
