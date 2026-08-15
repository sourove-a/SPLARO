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

export const MAX_LIBRARY_BYTES = 8 * 1024 * 1024
export const MAX_PRODUCT_BYTES = 12 * 1024 * 1024
export const MAX_PDF_BYTES = 20 * 1024 * 1024
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/**
 * Reject a file before it costs an upload. `target` matters because the product
 * pipeline accepts a larger raster than the library does.
 */
export function uploadRejection(file: File, target: 'library' | 'product' = 'library'): string | null {
  if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
    return 'Unsupported type — JPG, PNG, WebP, GIF, AVIF, SVG, PDF, MP4 or WebM.'
  }
  if (file.type.startsWith('video/') && file.size > MAX_VIDEO_BYTES) return 'Video over the 40MB limit.'
  if (file.type === 'application/pdf' && file.size > MAX_PDF_BYTES) return 'PDF over the 20MB limit.'
  if (RASTER_UPLOAD.has(file.type)) {
    const ceiling = target === 'product' ? MAX_PRODUCT_BYTES : MAX_LIBRARY_BYTES
    if (file.size > ceiling) {
      return target === 'product'
        ? 'Image over the 12MB product limit.'
        : 'Image over the 8MB library limit — attach it to a product instead.'
    }
  }
  return null
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
