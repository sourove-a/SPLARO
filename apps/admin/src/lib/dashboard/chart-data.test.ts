import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  barHeights,
  bucketOrdersByHour,
  buildFunnel,
  buildSourceSlices,
  hourLabel,
  peakHour,
  seriesIsEmpty,
} from './chart-data'

describe('bucketOrdersByHour', () => {
  it('buckets in Dhaka time, not UTC', () => {
    // 20:30 Dhaka = 14:30 UTC. Bucketing in UTC would report hour 14.
    const buckets = bucketOrdersByHour(['2026-08-20T14:30:00.000Z'])
    assert.equal(buckets[20]?.orders, 1)
    assert.equal(buckets[14]?.orders, 0)
  })

  it('always returns 24 zero-filled buckets', () => {
    const buckets = bucketOrdersByHour([])
    assert.equal(buckets.length, 24)
    assert.equal(buckets.every((b) => b.orders === 0 && b.intensity === 0), true)
  })

  it('scales intensity against the busiest hour', () => {
    const buckets = bucketOrdersByHour([
      '2026-08-20T04:00:00.000Z',
      '2026-08-20T04:10:00.000Z',
      '2026-08-20T06:00:00.000Z',
    ])
    assert.equal(buckets[10]?.intensity, 1)
    assert.equal(buckets[12]?.intensity, 0.5)
  })

  it('ignores unparseable timestamps instead of throwing', () => {
    const buckets = bucketOrdersByHour(['not-a-date', '2026-08-20T04:00:00.000Z'])
    assert.equal(buckets.reduce((n, b) => n + b.orders, 0), 1)
  })
})

describe('peakHour + hourLabel', () => {
  it('returns null when nothing happened', () => {
    assert.equal(peakHour(bucketOrdersByHour([])), null)
  })

  it('names the busiest hour', () => {
    const peak = peakHour(bucketOrdersByHour(['2026-08-20T04:00:00.000Z']))
    assert.equal(peak?.hour, 10)
    assert.equal(hourLabel(10), '10:00–11:00')
  })

  it('wraps the last hour label to midnight', () => {
    assert.equal(hourLabel(23), '23:00–00:00')
  })
})

describe('buildFunnel', () => {
  it('measures each step against the top and the step above', () => {
    const steps = buildFunnel([
      { label: 'Visitors', count: 1000 },
      { label: 'Cart', count: 189 },
      { label: 'Orders', count: 0 },
    ])
    assert.equal(steps[1]?.ofTop, 0.189)
    assert.equal(steps[2]?.fromPrev, 0)
  })

  it('clamps a step that is wider than its parent', () => {
    const steps = buildFunnel([
      { label: 'Visitors', count: 10 },
      { label: 'Cart', count: 40 },
    ])
    assert.equal(steps[1]?.ofTop, 1)
    assert.equal(steps[1]?.fromPrev, 1)
  })

  it('survives an all-zero funnel without dividing by zero', () => {
    const steps = buildFunnel([
      { label: 'Visitors', count: 0 },
      { label: 'Orders', count: 0 },
    ])
    assert.equal(steps.every((s) => s.ofTop === 0 && s.fromPrev === 0), true)
  })
})

describe('buildSourceSlices', () => {
  it('labels blank sources as direct and shares out of the total', () => {
    const slices = buildSourceSlices([
      { source: null, orders: 3, revenue: 300 },
      { source: 'facebook', orders: 1, revenue: 100 },
    ])
    assert.equal(slices[0]?.source, 'direct')
    assert.equal(slices[0]?.share, 0.75)
  })

  it('drops zero-order sources so the donut has no invisible slices', () => {
    const slices = buildSourceSlices([
      { source: 'google', orders: 0, revenue: 0 },
      { source: 'direct', orders: 2, revenue: 50 },
    ])
    assert.equal(slices.length, 1)
  })
})

describe('seriesIsEmpty + barHeights', () => {
  it('detects a series with no signal', () => {
    assert.equal(seriesIsEmpty([{ orders: 0, revenue: 0 }]), true)
    assert.equal(seriesIsEmpty([{ orders: 0, revenue: 12 }]), false)
  })

  it('keeps a visible stub for zero days and never exceeds the box', () => {
    const heights = barHeights([0, 5, 10], 100)
    assert.equal(heights[0], 2)
    assert.equal(heights[2], 100)
    assert.equal(heights[1], 50)
  })

  it('does not divide by zero on an all-zero series', () => {
    assert.deepEqual(barHeights([0, 0], 80), [2, 2])
  })
})
