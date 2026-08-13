import { BadRequestException } from '@nestjs/common'
import {
  isMediaDeptFolder,
  normalizeMediaFolder,
  resolveMediaFolderFilter,
} from './media-folder.util'

describe('normalizeMediaFolder', () => {
  it('slugifies a typed English name', () => {
    expect(normalizeMediaFolder('Eid Campaign')).toBe('eid-campaign')
    expect(normalizeMediaFolder('New   Folder!!!')).toBe('new-folder')
    expect(normalizeMediaFolder('  Winter Sale 2026 ')).toBe('winter-sale-2026')
  })

  it('folds case so one folder never appears twice in the picker', () => {
    expect(normalizeMediaFolder('Men')).toBe(normalizeMediaFolder('men'))
  })

  it('keeps Bangla letters and their kars intact', () => {
    // \p{M} matters here — without it "পুরুষ" collapses to "পরষ".
    expect(normalizeMediaFolder('পুরুষ')).toBe('পুরুষ')
    expect(normalizeMediaFolder('ঈদ কালেকশন')).toBe('ঈদ-কালেকশন')
    expect(normalizeMediaFolder('শীতের সেল ২০২৬')).toBe('শীতের-সেল-২০২৬')
  })

  it('strips characters that would be unsafe as a filter key', () => {
    expect(normalizeMediaFolder('<script>x</script>')).toBe('scriptxscript')
    expect(normalizeMediaFolder('a//b')).toBe('ab')
    expect(normalizeMediaFolder('../etc')).toBe('etc')
  })

  it('falls back when nothing usable is left', () => {
    expect(normalizeMediaFolder('---')).toBe('media')
    expect(normalizeMediaFolder('')).toBe('media')
    expect(normalizeMediaFolder('!!!', 'women')).toBe('women')
  })

  it('refuses the reserved "all" sentinel', () => {
    expect(() => normalizeMediaFolder('all')).toThrow(BadRequestException)
    expect(() => normalizeMediaFolder('  ALL  ')).toThrow(BadRequestException)
  })
})

describe('resolveMediaFolderFilter', () => {
  it('treats "all" and an absent value as no filter', () => {
    expect(resolveMediaFolderFilter('all')).toBe('')
    expect(resolveMediaFolderFilter('')).toBe('')
    expect(resolveMediaFolderFilter(undefined)).toBe('')
  })

  it('normalizes a real folder the same way the writer does', () => {
    expect(resolveMediaFolderFilter('Eid Campaign')).toBe(normalizeMediaFolder('Eid Campaign'))
  })
})

describe('isMediaDeptFolder', () => {
  it('is true only for the buckets with a product upload directory', () => {
    expect(isMediaDeptFolder('men')).toBe(true)
    expect(isMediaDeptFolder('accessories')).toBe(true)
    // 'media' is the general bucket, not a department.
    expect(isMediaDeptFolder('media')).toBe(false)
    expect(isMediaDeptFolder('eid-campaign')).toBe(false)
  })
})
