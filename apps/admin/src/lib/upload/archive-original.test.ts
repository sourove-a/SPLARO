import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  ARCHIVE_MAX_WIDTH,
  ARCHIVE_MIN_BYTES,
  archiveMaxWidth,
  archivePlan,
  envKeepRawOriginal,
} from './archive-original'
import { EXPECTED_MAX_BYTES, MAX_DIMENSION } from '@/lib/media/compress-before-upload'

const MB = 1024 * 1024

function withEnv(vars: Record<string, string | undefined>, run: () => void) {
  const saved: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(vars)) {
    saved[key] = process.env[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    run()
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

test('a big camera upload is re-encoded to a master', () => {
  const plan = archivePlan({ ext: 'jpg', rawBytes: 13 * MB, sourceWidth: 6000 })
  assert.equal(plan.strategy, 'master')
})

test('a photo already cheap enough is kept byte for byte', () => {
  // Under the byte floor and inside the cap: nothing to reclaim.
  assert.equal(archivePlan({ ext: 'jpg', rawBytes: ARCHIVE_MIN_BYTES, sourceWidth: 1200 }).strategy, 'raw')

  // Small bytes but huge dimensions still costs the ladder its source, so the
  // cap decides — a flat 6000px graphic compresses tiny and must still shrink.
  assert.equal(archivePlan({ ext: 'png', rawBytes: 100 * 1024, sourceWidth: 6000 }).strategy, 'master')
})

test('what the browser compressed is not compressed a second time', () => {
  const plan = archivePlan({ ext: 'webp', rawBytes: 1.2 * MB, sourceWidth: MAX_DIMENSION })
  assert.equal(plan.strategy, 'raw')
  assert.match(plan.reason, /browser-compressed/)
})

test('a hand-exported WebP does not slip through that passthrough', () => {
  // Inside the dimension cap but far heavier than the browser ever emits —
  // passing this through would opt the largest uploads out of the saving.
  const heavy = archivePlan({ ext: 'webp', rawBytes: EXPECTED_MAX_BYTES + 1, sourceWidth: 3000 })
  assert.equal(heavy.strategy, 'master')

  // Wider than the cap is squeezed whatever it weighs.
  assert.equal(archivePlan({ ext: 'webp', rawBytes: 1 * MB, sourceWidth: 5000 }).strategy, 'master')
})

test('the raw-original switch wins over every other rule', () => {
  const plan = archivePlan({ ext: 'jpg', rawBytes: 50 * MB, sourceWidth: 8000, keepRaw: true })
  assert.equal(plan.strategy, 'raw')
  assert.match(plan.reason, /PRODUCT_KEEP_RAW_ORIGINAL/)
})

test('a decode that reported no width is never squeezed on a guess', () => {
  // sourceWidth 0 means sharp could not read it; the size rules need a width to
  // be meaningful, so the file goes to the encoder that can fall back safely.
  assert.equal(archivePlan({ ext: 'jpg', rawBytes: 200 * 1024, sourceWidth: 0 }).strategy, 'master')
})

test('PRODUCT_KEEP_RAW_ORIGINAL reads the ways an operator writes it', () => {
  for (const on of ['1', 'true', 'TRUE', 'on', 'yes']) {
    withEnv({ PRODUCT_KEEP_RAW_ORIGINAL: on }, () => assert.equal(envKeepRawOriginal(), true, on))
  }
  for (const off of ['0', 'false', 'off', 'no', '', undefined]) {
    withEnv({ PRODUCT_KEEP_RAW_ORIGINAL: off }, () =>
      assert.equal(envKeepRawOriginal(), false, String(off)),
    )
  }
})

test('the width override is honoured, and nonsense falls back to the default', () => {
  withEnv({ PRODUCT_ORIGINAL_MAX_WIDTH: '1600' }, () => assert.equal(archiveMaxWidth(), 1600))
  withEnv({ PRODUCT_ORIGINAL_MAX_WIDTH: '4096' }, () => assert.equal(archiveMaxWidth(), 4096))

  // Below the width the pipeline itself demands, so it cannot be meant.
  withEnv({ PRODUCT_ORIGINAL_MAX_WIDTH: '12' }, () => assert.equal(archiveMaxWidth(), ARCHIVE_MAX_WIDTH))
  withEnv({ PRODUCT_ORIGINAL_MAX_WIDTH: 'wide' }, () => assert.equal(archiveMaxWidth(), ARCHIVE_MAX_WIDTH))
  withEnv({ PRODUCT_ORIGINAL_MAX_WIDTH: undefined }, () => assert.equal(archiveMaxWidth(), ARCHIVE_MAX_WIDTH))
})

test('the archive keeps headroom over the widest size the storefront serves', () => {
  assert.ok(ARCHIVE_MAX_WIDTH > 1600, 'a master must out-resolve the w1600 variant')
})
