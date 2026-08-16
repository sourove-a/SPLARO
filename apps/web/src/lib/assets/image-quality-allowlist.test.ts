import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { IMAGE_QUALITY } from './image-optimize.ts'

/**
 * Next 15 answers `/_next/image?...&q=N` with HTTP 400 when N is not listed in
 * `images.qualities`. StorefrontImage passes IMAGE_QUALITY[profile] straight
 * through, so any value missing from next.config.mjs silently breaks every
 * image on that profile — which is exactly how q=72 (heroMobile) shipped.
 */
function configuredQualities(): number[] {
  const here = dirname(fileURLToPath(import.meta.url))
  const configPath = join(here, '..', '..', '..', 'next.config.mjs')
  const source = readFileSync(configPath, 'utf8')
  const match = /qualities:\s*\[([^\]]*)\]/.exec(source)
  assert.ok(match?.[1], 'images.qualities not found in next.config.mjs')
  return match[1]
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value))
}

describe('next/image quality allowlist', () => {
  it('allows every quality StorefrontImage can request', () => {
    const allowed = new Set(configuredQualities())
    const missing = Object.entries(IMAGE_QUALITY)
      .filter(([, quality]) => !allowed.has(quality))
      .map(([profile, quality]) => `${profile}=${quality}`)

    assert.deepEqual(
      missing,
      [],
      `next.config.mjs images.qualities is missing: ${missing.join(', ')}`,
    )
  })

  it('allows the quality literals passed directly in JSX', () => {
    const allowed = new Set(configuredQualities())
    for (const quality of [82, 88, 100]) {
      assert.ok(allowed.has(quality), `images.qualities must include ${quality}`)
    }
  })
})
