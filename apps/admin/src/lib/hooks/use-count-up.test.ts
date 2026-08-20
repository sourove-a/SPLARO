import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { COUNT_UP_MS, countUpFrame, easeOutCubic, shouldSkipCountUp } from './use-count-up'

describe('easeOutCubic', () => {
  it('starts at 0 and ends at 1', () => {
    assert.equal(easeOutCubic(0), 0)
    assert.equal(easeOutCubic(1), 1)
  })

  it('is front-loaded — half the time is well past half the distance', () => {
    assert.ok(easeOutCubic(0.5) > 0.8)
  })

  it('clamps input rather than overshooting the target', () => {
    assert.equal(easeOutCubic(1.4), 1)
    assert.equal(easeOutCubic(-2), 0)
  })
})

describe('countUpFrame', () => {
  it('lands exactly on the target on the final frame', () => {
    assert.equal(countUpFrame(0, 4137, COUNT_UP_MS), 4137)
    assert.equal(countUpFrame(0, 4137, COUNT_UP_MS + 50), 4137)
  })

  it('starts from the previous value, not from zero', () => {
    assert.equal(countUpFrame(4000, 4200, 0), 4000)
  })

  it('stays inside the range while running', () => {
    const mid = countUpFrame(100, 200, COUNT_UP_MS / 2)
    assert.ok(mid > 100 && mid < 200)
  })

  it('counts down as well as up', () => {
    const mid = countUpFrame(500, 100, COUNT_UP_MS / 2)
    assert.ok(mid < 500 && mid > 100)
  })
})

describe('shouldSkipCountUp', () => {
  it('skips under reduced motion', () => {
    assert.equal(shouldSkipCountUp(0, 900, true), true)
  })

  it('skips a sub-unit change — a poll that moves nothing must not re-animate', () => {
    assert.equal(shouldSkipCountUp(4137, 4137, false), true)
    assert.equal(shouldSkipCountUp(4137, 4137.4, false), true)
  })

  it('animates a real change', () => {
    assert.equal(shouldSkipCountUp(0, 12, false), false)
  })

  it('skips non-finite input instead of rendering NaN', () => {
    assert.equal(shouldSkipCountUp(Number.NaN, 10, false), true)
    assert.equal(shouldSkipCountUp(0, Number.POSITIVE_INFINITY, false), true)
  })
})
