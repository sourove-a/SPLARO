/**
 * Shrink a photo in the browser before a single byte goes to the server.
 *
 * A 13MB camera JPEG is minutes of wire time on a domestic uplink, and the
 * storefront never shows more than 1600px of it. Re-encoding to a capped WebP
 * first turns that upload into roughly one second of CPU and a tenth of the
 * bytes.
 *
 * It is not free, and the cost is worth stating plainly. Measured end to end —
 * browser encode, then the `w1200` variant `runProductPipeline` builds from it,
 * against a lossless build of the same variant:
 *
 * | uploaded                | size    | upload | PSNR    | SSIM   |
 * | ----------------------- | ------- | ------ | ------- | ------ |
 * | raw 13.4MB JPEG (today) | 13733KB |   1.0x | 38.9 dB | 0.9703 |
 * | 4096px WebP q90         |  2134KB |   6.4x | 37.6 dB | 0.9588 |
 * | 3200px WebP q90         |  1189KB |  11.6x | 37.3 dB | 0.9559 |
 * | 2560px WebP q90         |   791KB |  17.4x | 36.8 dB | 0.9504 |
 *
 * The loss is resampling, not compression: a *lossless* WebP at the same cap
 * scores the same as quality 85, so the quality number is nearly free and the
 * cap is the only real dial. `MAX_DIMENSION` sits at 3200 because that is where
 * the curve flattens — dropping from 4096 costs 0.003 SSIM and nearly doubles
 * the speed-up — and because it is exactly twice the widest size the storefront
 * serves, so the server's own 1600px encode is a clean halving.
 */

/** Twice the widest variant `route.ts` builds. See the table above. */
export const MAX_DIMENSION = 3200
/**
 * Mirrors `MIN_PRODUCT_WIDTH` in `@/lib/upload/product-ai-upscale`, which
 * `runProductPipeline` rejects below. Capping is not allowed to push an upload
 * under it — see `targetDimensions`.
 */
export const MIN_WIDTH = 800
/** Lossless scores the same as 85 here, so this buys headroom, not bytes. */
export const QUALITY = 0.9
/**
 * Below this an upload is already seconds, and a re-encode would spend a
 * generation of quality to save time nobody was waiting on.
 */
export const MIN_BYTES = 1.5 * 1024 * 1024
/**
 * The largest this encoder is expected to produce, measured with headroom: the
 * grain-heavy 13.4MB worst case comes back at 1165KB and a clean studio photo
 * at 814KB. The server uses it to tell a file this made from a WebP an operator
 * exported by hand, which has had no pixels taken off it and still should.
 */
export const EXPECTED_MAX_BYTES = 2.5 * 1024 * 1024

/**
 * JPEG only, deliberately.
 *
 * PNG is where logos, flat art and screenshots arrive, and lossy WebP is at its
 * worst on hard edges and small text — exactly what a brand mark is made of.
 * GIF would lose its animation, and SVG, PDF and video have no business in a
 * raster canvas at all. A camera photo is a JPEG, which is the case this is for.
 */
export function shouldCompress(file: { type: string; size: number }): boolean {
  return file.type === 'image/jpeg' && file.size > MIN_BYTES
}

/**
 * The box to draw into, never larger than the source.
 *
 * Enlarging would invent detail and cost bytes for it, and a photo already
 * under the cap has nothing to give back.
 */
export function targetDimensions(
  width: number,
  height: number,
  cap = MAX_DIMENSION,
): { width: number; height: number; resized: boolean } {
  const longest = Math.max(width, height)
  if (!Number.isFinite(longest) || longest <= 0) return { width, height, resized: false }
  if (longest <= cap) return { width, height, resized: false }

  let scale = cap / longest
  // A tall photo caps on its height, and that can drag its width under the
  // floor `runProductPipeline` rejects below — turning an upload the admin
  // could make yesterday into "Product photo too small". Stop short of it: a
  // portrait shot stays taller than the cap rather than becoming unusable.
  if (width >= MIN_WIDTH && width * scale < MIN_WIDTH) scale = MIN_WIDTH / width
  if (scale >= 1) return { width, height, resized: false }

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    resized: true,
  }
}

/**
 * Whether the re-encode actually earned its place.
 *
 * An already-tight JPEG can come back *larger* as WebP, and a browser that
 * cannot encode WebP quietly hands back a PNG several times the size — both
 * would make the upload slower and the photo worse, which is the opposite of
 * the point. Anything but a genuinely smaller WebP is discarded.
 */
export function isWorthUploading(
  original: { size: number },
  candidate: { size: number; type: string },
): boolean {
  return candidate.type === 'image/webp' && candidate.size > 0 && candidate.size < original.size
}

export type CompressionOutcome = {
  /** The file to upload — the original itself whenever compression was skipped or rejected. */
  file: File
  compressed: boolean
  originalBytes: number
}

/** `photo.jpg` → `photo.webp`, so the media library still reads like the source. */
function webpName(name: string): string {
  return `${name.replace(/\.[^.]+$/, '') || 'image'}.webp`
}

async function encode(
  bitmap: ImageBitmap,
  width: number,
  height: number,
): Promise<Blob | null> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(bitmap, 0, 0, width, height)
    return canvas.convertToBlob({ type: 'image/webp', quality: QUALITY })
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null
  context.drawImage(bitmap, 0, 0, width, height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', QUALITY))
}

/**
 * Re-encode a photo for upload, or hand back exactly what was passed in.
 *
 * Every failure is a fallback rather than an error: an upload that still works
 * at full size beats one that stops because a canvas was unavailable, so a
 * missing API, a decode failure, a tainted canvas and a browser without WebP
 * all end the same way.
 */
export async function compressImageForUpload(file: File): Promise<CompressionOutcome> {
  const untouched: CompressionOutcome = { file, compressed: false, originalBytes: file.size }
  if (!shouldCompress(file)) return untouched
  if (typeof createImageBitmap !== 'function') return untouched

  let source: ImageBitmap | null = null
  let scaled: ImageBitmap | null = null
  try {
    // `from-image` first, so a phone photo's EXIF rotation is applied before
    // anything measures it — otherwise a portrait shot caps on the wrong side.
    source = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const target = targetDimensions(source.width, source.height)

    // The browser's own resampler, asked for its best. Drawing a 6000px bitmap
    // straight into a small canvas aliases badly; this does not.
    scaled = target.resized
      ? await createImageBitmap(source, {
          resizeWidth: target.width,
          resizeHeight: target.height,
          resizeQuality: 'high',
        })
      : source

    const blob = await encode(scaled, target.width, target.height)
    if (!blob || !isWorthUploading(file, blob)) return untouched
    return {
      file: new File([blob], webpName(file.name), { type: 'image/webp', lastModified: file.lastModified }),
      compressed: true,
      originalBytes: file.size,
    }
  } catch {
    return untouched
  } finally {
    scaled?.close()
    if (scaled !== source) source?.close()
  }
}
