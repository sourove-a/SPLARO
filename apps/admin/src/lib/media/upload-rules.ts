import { ApiError } from '@/lib/api/client'
import { deleteOrphanUpload } from '@/lib/api/media'

/**
 * What the media library accepts, and what to do when an upload half-lands.
 *
 * The single-file modal and the multi-file queue both enforce these, so the
 * limits live here rather than being written twice and drifting apart. They
 * mirror the guards in `apps/admin/src/app/api/upload/route.ts` — a file that
 * passes here can still be refused there, never the other way round.
 */

export const RASTER_UPLOAD = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])

export const ALLOWED_UPLOAD_TYPES = new Set([
  ...RASTER_UPLOAD,
  'image/svg+xml',
  'application/pdf',
  'video/mp4',
  'video/webm',
])

/**
 * One ceiling for every upload.
 *
 * Four different limits meant four different rejection messages for what an
 * admin experiences as one action, and the low raster ceiling pushed people
 * into shrinking photos by hand. The route streams the body to disk instead of
 * buffering it, so a large file costs time on the wire rather than memory on
 * the box — one number is both simpler and honest about the real constraint.
 */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024
export const MAX_UPLOAD_LABEL = '100MB'

export const MAX_LIBRARY_BYTES = MAX_UPLOAD_BYTES
export const MAX_PRODUCT_BYTES = MAX_UPLOAD_BYTES
export const MAX_PDF_BYTES = MAX_UPLOAD_BYTES
export const MAX_VIDEO_BYTES = MAX_UPLOAD_BYTES

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/** Reject a file before it costs an upload. */
export function uploadRejection(file: File): string | null {
  if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
    return 'Unsupported type — JPG, PNG, WebP, GIF, AVIF, SVG, PDF, MP4 or WebM.'
  }
  if (file.size > MAX_UPLOAD_BYTES) return `Over the ${MAX_UPLOAD_LABEL} limit.`
  return null
}

/**
 * A file the upload route re-encodes with sharp, rather than passing straight
 * through to disk. Callers use it to keep the CPU-bound files off the wide lane
 * of a batch — see `DcUploadQueue`.
 */
export function needsServerProcessing(file: File, optimize: boolean, watermark: boolean): boolean {
  if (!RASTER_UPLOAD.has(file.type) || file.type === 'image/gif') return false
  return optimize || watermark
}

/**
 * How long an upload of this size is allowed to take.
 *
 * A fixed 90s ceiling failed every large file on a normal Bangladeshi uplink
 * before the bytes had a chance to land. This budgets ~150 KB/s of wire time on
 * top of a fixed processing allowance, and caps out at 20 minutes.
 */
export function uploadTimeoutMs(sizeBytes: number): number {
  return Math.min(20 * 60_000, 90_000 + Math.round(sizeBytes / 150))
}

/**
 * Delete an upload that never got indexed.
 *
 * A 409 means the API still sees the file as in-flight, so the delete is retried
 * on a short backoff; any other failure is real and propagates.
 */
export async function cleanupOrphanWithRetry(path: string): Promise<void> {
  let lastError: unknown
  for (const waitMs of [0, 500, 1_500, 3_000]) {
    if (waitMs) await delay(waitMs)
    try {
      await deleteOrphanUpload(path)
      return
    } catch (error) {
      lastError = error
      if (!(error instanceof ApiError) || error.status !== 409) throw error
    }
  }
  throw lastError
}
