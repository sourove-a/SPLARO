import { MIN_PRODUCT_WIDTH } from '@/lib/upload/product-ai-upscale'
import {
  EXPECTED_MAX_BYTES as CLIENT_UPLOAD_MAX_BYTES,
  MAX_DIMENSION as CLIENT_UPLOAD_MAX_DIMENSION,
} from '@/lib/media/compress-before-upload'

/**
 * What the kept-forever copy of a product photo is allowed to cost.
 *
 * Every product upload used to leave its raw file on disk untouched, so a 5MB
 * phone photo billed 5MB of the volume for the rest of its life while the five
 * WebP and five AVIF sizes the storefront actually serves came to well under
 * one. The archive, not the ladder, is what fills the disk.
 *
 * `ARCHIVE_MAX_WIDTH` sits at 2560 because the widest thing the site ever
 * serves is 1600 — a master at this size still holds a full re-crop of
 * headroom, and no pixel a customer sees is built from more than it. At quality
 * 90 WebP that turns a 3MB 6000x4000 original into roughly 700KB with nothing
 * visible to separate the two at any size in `PRODUCT_VARIANT_WIDTHS`.
 *
 * It is a re-encode, so it is not bit-identical to what was uploaded. Stores
 * that need the camera file itself — print, licensing, a future model that
 * wants the raw grain — set `PRODUCT_KEEP_RAW_ORIGINAL=1` and pay the bytes.
 */
export const ARCHIVE_MAX_WIDTH = 2560
export const ARCHIVE_QUALITY = 90
/**
 * Under this the raw file is already cheap, and a re-encode costs a second of
 * CPU to save a few dozen KB — below the noise of one page view.
 */
export const ARCHIVE_MIN_BYTES = 512 * 1024

/** Opt back in to storing the untouched camera file. Default OFF. */
export function envKeepRawOriginal(): boolean {
  const raw = (process.env.PRODUCT_KEEP_RAW_ORIGINAL ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes'
}

/** Per-store override for how much headroom the master keeps. */
export function archiveMaxWidth(): number {
  const requested = Number(process.env.PRODUCT_ORIGINAL_MAX_WIDTH ?? '')
  if (!Number.isFinite(requested) || requested < MIN_PRODUCT_WIDTH) return ARCHIVE_MAX_WIDTH
  return Math.round(requested)
}

export type ArchivePlan = {
  /** `raw` copies the upload verbatim; `master` re-encodes it to a capped WebP. */
  strategy: 'raw' | 'master'
  /** Why, in words an operator reading a log would understand. */
  reason: string
}

/**
 * Decide how an upload should be archived, without touching a disk.
 *
 * Kept apart from the encoding so the policy can be read and tested on its own:
 * every branch here decides whether a photo keeps its bytes or gives them up,
 * and each has a case behind it that is easy to break by accident.
 */
export function archivePlan(input: {
  ext: string
  rawBytes: number
  sourceWidth: number
  maxWidth?: number
  keepRaw?: boolean
}): ArchivePlan {
  const maxWidth = input.maxWidth ?? ARCHIVE_MAX_WIDTH
  if (input.keepRaw) {
    return { strategy: 'raw', reason: 'PRODUCT_KEEP_RAW_ORIGINAL is on' }
  }
  // Already small, and no wider than the master would be: re-encoding it would
  // spend CPU and lose a generation of quality for nothing.
  if (input.rawBytes <= ARCHIVE_MIN_BYTES && input.sourceWidth > 0 && input.sourceWidth <= maxWidth) {
    return { strategy: 'raw', reason: 'already small enough to keep verbatim' }
  }
  // The browser already did this job on the way here — `compressImageForUpload`
  // caps at `CLIENT_UPLOAD_MAX_DIMENSION` and encodes WebP — so squeezing its
  // output again would spend a second generation of loss on the one copy kept
  // to rebuild from, and save very little for it.
  //
  // The size ceiling is what keeps that from becoming a hole: a WebP an
  // operator exported by hand can sit inside the dimension cap and still be
  // several megabytes, and passing those through would quietly opt the largest
  // uploads out of the saving this exists for.
  if (
    input.ext === 'webp' &&
    input.sourceWidth > 0 &&
    input.sourceWidth <= CLIENT_UPLOAD_MAX_DIMENSION &&
    input.rawBytes <= CLIENT_UPLOAD_MAX_BYTES
  ) {
    return { strategy: 'raw', reason: 'already a browser-compressed WebP master' }
  }
  return { strategy: 'master', reason: `re-encode to ${maxWidth}px WebP q${ARCHIVE_QUALITY}` }
}
