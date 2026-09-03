import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  nextSmallerVariantWidth,
  optimizeImageSrc,
  productVariantWidth,
  PRODUCT_VARIANT_WIDTHS,
  withProductVariantWidth,
} from './image-optimize.ts'

/**
 * The upload pipeline only writes a variant width the master can fill, so
 * asking for one it skipped 404s and StorefrontImage used to fall straight to
 * the brand placeholder — which is how the lightbox came up blank for every
 * 1200px product photo.
 */
function pipelineWidths(): number[] {
  const here = dirname(fileURLToPath(import.meta.url))
  const routePath = join(here, '..', '..', '..', '..', 'admin', 'src', 'app', 'api', 'upload', 'route.ts')
  const source = readFileSync(routePath, 'utf8')
  const match = /PRODUCT_VARIANT_WIDTHS\s*=\s*\[([^\]]*)\]/.exec(source)
  assert.ok(match?.[1], 'PRODUCT_VARIANT_WIDTHS not found in the admin upload route')
  return match[1]
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value))
}

describe('product variant fallback', () => {
  const sample = '/uploads/media/1788475689932-18bc544a51d9477c.w1200.webp'

  it('knows every width the upload pipeline can write', () => {
    assert.deepEqual([...PRODUCT_VARIANT_WIDTHS].sort((a, b) => a - b), pipelineWidths().sort((a, b) => a - b))
  })

  it('reads the width back out of a variant URL', () => {
    assert.equal(productVariantWidth(sample), 1200)
    assert.equal(productVariantWidth('https://splaro.co/uploads/products/x.w828.avif'), 828)
    assert.equal(productVariantWidth('/uploads/media/legacy.jpg'), null)
  })

  it('rewrites a variant to another width and format', () => {
    assert.equal(
      withProductVariantWidth(sample, 828, 'avif'),
      '/uploads/media/1788475689932-18bc544a51d9477c.w828.avif',
    )
  })

  it('steps down one rung at a time and stops at the bottom', () => {
    assert.equal(nextSmallerVariantWidth(1600), 1200)
    assert.equal(nextSmallerVariantWidth(1200), 828)
    assert.equal(nextSmallerVariantWidth(480), 160)
    assert.equal(nextSmallerVariantWidth(160), null)
  })

  it('asks the lightbox for a width the gallery has already fetched', () => {
    assert.equal(optimizeImageSrc(sample, 'lightbox'), optimizeImageSrc(sample, 'gallery'))
  })
})
