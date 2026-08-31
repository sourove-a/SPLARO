import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_DIMENSION,
  MIN_BYTES,
  MIN_WIDTH,
  isWorthUploading,
  shouldCompress,
  targetDimensions,
} from './compress-before-upload'

const MB = 1024 * 1024

test('only large JPEGs are re-encoded', () => {
  assert.equal(shouldCompress({ type: 'image/jpeg', size: 10 * MB }), true)

  // Small enough that the upload was never the slow part.
  assert.equal(shouldCompress({ type: 'image/jpeg', size: MIN_BYTES }), false)

  // Lossy WebP ruins the hard edges these are made of, or destroys them outright.
  for (const type of ['image/png', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml']) {
    assert.equal(shouldCompress({ type, size: 10 * MB }), false, `${type} must pass through`)
  }
  for (const type of ['application/pdf', 'video/mp4', 'video/webm']) {
    assert.equal(shouldCompress({ type, size: 60 * MB }), false, `${type} must pass through`)
  }
})

test('the cap is a ceiling, never a target', () => {
  // A 6000x4000 camera frame lands on its long edge, aspect ratio intact.
  const landscape = targetDimensions(6000, 4000)
  assert.deepEqual(landscape, { width: 3200, height: 2133, resized: true })

  // Portrait caps on height — the EXIF rotation is applied before this runs.
  const portrait = targetDimensions(4000, 6000)
  assert.deepEqual(portrait, { width: 2133, height: 3200, resized: true })

  // Already inside the cap: untouched, and never enlarged.
  assert.deepEqual(targetDimensions(1000, 800), { width: 1000, height: 800, resized: false })
  assert.deepEqual(targetDimensions(MAX_DIMENSION, MAX_DIMENSION), {
    width: MAX_DIMENSION,
    height: MAX_DIMENSION,
    resized: false,
  })

  // A decode that reported nothing is not something to divide by.
  assert.deepEqual(targetDimensions(0, 0), { width: 0, height: 0, resized: false })
})

test('capping never pushes a photo under the width the pipeline demands', () => {
  // A tall 1000x6000 shot: capping the long edge would leave it 533px wide and
  // runProductPipeline would reject what it accepts today. It stays 800 wide
  // and taller than the cap instead.
  const tall = targetDimensions(1000, 6000)
  assert.equal(tall.width, MIN_WIDTH)
  assert.equal(tall.height, 4800)
  assert.equal(tall.resized, true)

  // A photo already narrower than the floor is the server's business to refuse,
  // not something to enlarge into acceptance.
  const narrow = targetDimensions(600, 9000)
  assert.ok(narrow.width <= 600, 'must never widen a photo to pass the floor')

  // The ordinary landscape case is untouched by the guard.
  assert.deepEqual(targetDimensions(6000, 4000), { width: 3200, height: 2133, resized: true })
})

test('the cap stays above what the storefront serves', () => {
  // route.ts builds up to w1600; an upload capped below that would starve the
  // widest variant and downscale the whole ladder with it.
  assert.ok(MAX_DIMENSION >= 1600 * 2, 'cap must leave the 1600px variant a clean halving')
})

test('a re-encode is only kept when it is genuinely smaller WebP', () => {
  assert.equal(isWorthUploading({ size: 10 * MB }, { size: 1 * MB, type: 'image/webp' }), true)

  // A browser that cannot encode WebP hands back a PNG several times the size.
  assert.equal(isWorthUploading({ size: 10 * MB }, { size: 30 * MB, type: 'image/png' }), false)
  assert.equal(isWorthUploading({ size: 10 * MB }, { size: 1 * MB, type: 'image/png' }), false)

  // An already-tight JPEG can come back larger, or exactly the same.
  assert.equal(isWorthUploading({ size: 2 * MB }, { size: 3 * MB, type: 'image/webp' }), false)
  assert.equal(isWorthUploading({ size: 2 * MB }, { size: 2 * MB, type: 'image/webp' }), false)

  // An empty blob is a failed encode, not a very good one.
  assert.equal(isWorthUploading({ size: 2 * MB }, { size: 0, type: 'image/webp' }), false)
})
