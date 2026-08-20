import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  GOTO_WINDOW_MS,
  parseRecentPages,
  pushRecentPage,
  resolveGotoKey,
  RECENT_PAGES_LIMIT,
} from './keyboard-nav'

const base = { now: 1000, hasModifier: false, typing: false }

describe('resolveGotoKey', () => {
  it('arms on the leader key, then navigates on the target key', () => {
    assert.deepEqual(resolveGotoKey({ armedAt: null }, 'g', base), { action: 'arm' })
    assert.deepEqual(resolveGotoKey({ armedAt: 1000 }, 'o', { ...base, now: 1200 }), {
      action: 'navigate',
      href: '/dashboard/orders',
      label: 'Orders',
    })
  })

  it('is case-insensitive so caps lock does not break it', () => {
    assert.equal(resolveGotoKey({ armedAt: null }, 'G', base).action, 'arm')
    assert.equal(resolveGotoKey({ armedAt: 1000 }, 'P', { ...base, now: 1100 }).action, 'navigate')
  })

  it('expires an abandoned sequence instead of firing later', () => {
    const late = resolveGotoKey({ armedAt: 1000 }, 'o', { ...base, now: 1000 + GOTO_WINDOW_MS + 1 })
    assert.equal(late.action, 'ignore')
  })

  it('never fires while the operator is typing', () => {
    assert.equal(resolveGotoKey({ armedAt: null }, 'g', { ...base, typing: true }).action, 'ignore')
    assert.equal(
      resolveGotoKey({ armedAt: 1000 }, 'o', { ...base, typing: true }).action,
      'ignore',
    )
  })

  it('leaves modifier combinations to the browser', () => {
    assert.equal(resolveGotoKey({ armedAt: null }, 'g', { ...base, hasModifier: true }).action, 'ignore')
  })

  it('resets on an unmapped second key rather than staying armed', () => {
    assert.deepEqual(resolveGotoKey({ armedAt: 1000 }, 'z', { ...base, now: 1100 }), {
      action: 'reset',
    })
  })

  it('ignores a stray key when nothing is armed', () => {
    assert.equal(resolveGotoKey({ armedAt: null }, 'o', base).action, 'ignore')
  })
})

describe('pushRecentPage', () => {
  const page = (href: string, at = 1) => ({ href, label: href, at })

  it('puts the newest first', () => {
    const list = pushRecentPage([page('/a')], page('/b', 2))
    assert.deepEqual(list.map((p) => p.href), ['/b', '/a'])
  })

  it('moves a revisit to the top instead of duplicating it', () => {
    const list = pushRecentPage([page('/a'), page('/b')], page('/b', 3))
    assert.deepEqual(list.map((p) => p.href), ['/b', '/a'])
    assert.equal(list.length, 2)
  })

  it('caps the list', () => {
    let list: ReturnType<typeof page>[] = []
    for (let i = 0; i < RECENT_PAGES_LIMIT + 4; i += 1) list = pushRecentPage(list, page(`/p${i}`, i))
    assert.equal(list.length, RECENT_PAGES_LIMIT)
    assert.equal(list[0]?.href, `/p${RECENT_PAGES_LIMIT + 3}`)
  })

  it('ignores a blank href', () => {
    assert.equal(pushRecentPage([], page('  ')).length, 0)
  })
})

describe('parseRecentPages', () => {
  it('returns an empty list for junk instead of throwing', () => {
    assert.deepEqual(parseRecentPages('not json'), [])
    assert.deepEqual(parseRecentPages(null), [])
    assert.deepEqual(parseRecentPages('{"href":"/a"}'), [])
  })

  it('drops malformed rows but keeps good ones', () => {
    const parsed = parseRecentPages(
      JSON.stringify([{ href: '/a', label: 'A', at: 1 }, { href: 5 }, null]),
    )
    assert.deepEqual(parsed.map((p) => p.href), ['/a'])
  })
})
