import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { beginSwipe, resolveSwipe, trackSwipe, type SwipeState } from './lightbox-swipe'

const OPEN = { mediaCount: 5, scale: 1 }

/** Replay a finger path: down at (0,0), through the points, released at the last. */
function swipe(path: Array<[number, number]>, options = OPEN): 'next' | 'prev' | null {
  let state = beginSwipe(0, 0, options)
  if (!state) return null
  for (const [x, y] of path) state = trackSwipe(state as SwipeState, x, y)
  const last = path[path.length - 1] ?? [0, 0]
  return resolveSwipe(state as SwipeState, last[0], last[1])
}

describe('beginSwipe', () => {
  it('arms on a normal open viewer', () => {
    assert.notEqual(beginSwipe(10, 10, OPEN), null)
  })

  it('does not arm for a single photo', () => {
    assert.equal(beginSwipe(10, 10, { mediaCount: 1, scale: 1 }), null)
  })

  it('does not arm while the photo is zoomed — that drag pans', () => {
    assert.equal(beginSwipe(10, 10, { mediaCount: 5, scale: 2 }), null)
  })

  it('still arms at the resting scale despite float drift', () => {
    assert.notEqual(beginSwipe(10, 10, { mediaCount: 5, scale: 1.0000001 }), null)
  })
})

describe('resolveSwipe', () => {
  it('reads a leftward drag as the next photo', () => {
    assert.equal(swipe([[-20, 0], [-60, 4]]), 'next')
  })

  it('reads a rightward drag as the previous photo', () => {
    assert.equal(swipe([[20, 0], [60, 4]]), 'prev')
  })

  it('ignores a tap', () => {
    assert.equal(swipe([[1, 1]]), null)
  })

  it('ignores a drag that never travels far enough', () => {
    assert.equal(swipe([[-14, 0], [-20, 0]]), null)
  })

  it('ignores a vertical drag even when it drifts sideways at the end', () => {
    // Axis locks on the first real movement, so a scroll attempt that wanders
    // cannot turn into a slide change.
    assert.equal(swipe([[2, 40], [-60, 90]]), null)
  })

  it('holds the horizontal lock through a diagonal finish', () => {
    assert.equal(swipe([[-30, 2], [-70, 30]]), 'next')
  })

  it('rejects a drag that is mostly vertical', () => {
    assert.equal(swipe([[-40, 60]]), null)
  })
})
