import { uploadTimeoutMs } from '@/lib/media/upload-rules'
import { compressImageForUpload } from '@/lib/media/compress-before-upload'

export type UploadAdminImageOptions = {
  /** Product pipeline ON/OFF. Only applied when folder is `products`. Default true. */
  pipeline?: boolean
  /** Legacy single-file optimize (non-product or pipeline off). Default true. */
  optimize?: boolean
  /** Approved AI upscale preview id — variants built from upscaled buffer; original file kept. */
  upscalePreviewId?: string
  /** Browser upload progress. Server optimization starts after this reaches 100. */
  onProgress?: (percent: number) => void
  /** Cancels browser upload/processing wait when modal closes or user retries. */
  signal?: AbortSignal
  /** Composite the SPLARO mark on raster library uploads. */
  watermark?: boolean
  /** Requested unique upload ID to track pending processing marker. */
  uploadId?: string
  /**
   * Shrink a large JPEG in the browser first. Default true — see
   * `compress-before-upload.ts` for what it costs and what it saves.
   */
  compress?: boolean
}

export type UploadAdminImageResult = {
  url: string
  pipeline?: boolean
  warning?: string
  sourceWidth?: number
  aiUpscaled?: boolean
  originalUrl?: string
  publicUrl?: string
  r2Url?: string | null
  width?: number | null
  height?: number | null
  sizeBytes?: number
  mimeType?: string
  contentHash?: string
  kind?: string
  watermarked?: boolean
}

export type UpscaleStatus = {
  available: boolean
  reason: string | null
  offerBelow: number
  minWithoutUpscale: number
  minWithUpscale: number
}

export type UpscalePreviewResult = {
  previewId: string
  previewUrl: string
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
  method: string
}

export async function fetchUpscaleStatus(): Promise<UpscaleStatus> {
  const res = await fetch('/api/upload/upscale-status', { cache: 'no-store' })
  const data = (await res.json()) as UpscaleStatus & { error?: string }
  if (!res.ok) {
    return {
      available: false,
      reason: data.error ?? 'Could not check AI upscale status',
      offerBelow: 1200,
      minWithoutUpscale: 800,
      minWithUpscale: 400,
    }
  }
  return data
}

export async function createUpscalePreview(file: File): Promise<UpscalePreviewResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/upload/upscale-preview', { method: 'POST', body: form })
  const data = (await res.json()) as UpscalePreviewResult & { error?: string }
  if (!res.ok) throw new Error(data.error ?? 'AI upscale preview failed')
  if (!data.previewId || !data.previewUrl) throw new Error('AI upscale preview failed')
  return data
}

/** Best-effort delete of original + all size siblings for a product pipeline URL. */
export async function deleteProductPipelineUpload(url: string): Promise<void> {
  if (!/\/uploads\/products(?:-[a-z]+)?\//.test(url)) return
  try {
    await fetch('/api/upload/product-pipeline', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
  } catch {
    /* orphan cleanup is best-effort — never block UI */
  }
}

/**
 * Upload one file to the admin upload route.
 *
 * The body is the raw file, not a multipart form. Multipart made the browser
 * copy and base64-frame every byte before a single one went out, and made the
 * server buffer the whole thing in memory before it could touch disk — on a
 * 100MB video that is the difference between "slow" and "impossible". Sending
 * the Blob straight through lets nginx and Node stream it to disk as it
 * arrives, so the metadata rides in the query string instead.
 */
export async function uploadAdminImage(
  file: File,
  folder = 'products',
  options: UploadAdminImageOptions = {},
): Promise<UploadAdminImageResult> {
  // Before anything measures or sends it: a 13MB camera JPEG becomes roughly
  // 1.2MB here, which is the difference between a minutes-long upload and a
  // short one. Declines to touch anything it cannot improve, so `upload` is the
  // original file whenever compression was skipped or came out no smaller.
  const { file: upload } = options.compress === false
    ? { file }
    : await compressImageForUpload(file)

  const params = new URLSearchParams({
    raw: '1',
    folder,
    optimize: options.optimize === false ? '0' : '1',
    filename: upload.name,
  })
  if (options.watermark) params.set('watermark', '1')
  if (options.uploadId) params.set('uploadId', options.uploadId)
  if (folder === 'products' || folder.startsWith('products-')) {
    params.set('pipeline', options.pipeline === false ? '0' : '1')
    if (options.upscalePreviewId) params.set('upscalePreviewId', options.upscalePreviewId)
  }
  const url = `/api/upload?${params.toString()}`
  const contentType = upload.type || 'application/octet-stream'
  const timeoutMs = uploadTimeoutMs(upload.size)

  if (typeof XMLHttpRequest !== 'undefined') {
    return uploadWithProgress(url, upload, contentType, timeoutMs, options.onProgress, options.signal)
  }

  const controller = new AbortController()
  const abortFromCaller = () => controller.abort()
  options.signal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      body: upload,
      headers: { 'Content-Type': contentType },
      signal: controller.signal,
    })
    const data = (await res.json()) as UploadAdminImageResult & { error?: string }
    if (!res.ok) throw new Error(data.error ?? 'Upload failed')
    if (!data.url) throw new Error('Upload failed')
    return data
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Upload timed out — check the connection and retry.')
    }
    throw err
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abortFromCaller)
  }
}

function uploadWithProgress(
  url: string,
  body: File,
  contentType: string,
  timeoutMs: number,
  onProgress: ((percent: number) => void) | undefined,
  signal?: AbortSignal,
): Promise<UploadAdminImageResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const abort = () => xhr.abort()
    if (signal?.aborted) {
      reject(new Error('Upload cancelled'))
      return
    }
    signal?.addEventListener('abort', abort, { once: true })
    const finish = () => signal?.removeEventListener('abort', abort)
    xhr.open('POST', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.timeout = timeoutMs
    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
      }
    }
    xhr.onerror = () => {
      finish()
      reject(new Error('Network error while uploading image'))
    }
    xhr.onabort = () => {
      finish()
      reject(new Error('Upload cancelled'))
    }
    xhr.ontimeout = () => {
      finish()
      reject(new Error('Upload timed out — check the connection and retry.'))
    }
    xhr.onload = () => {
      let data: UploadAdminImageResult & { error?: string }
      try {
        data = JSON.parse(xhr.responseText) as UploadAdminImageResult & { error?: string }
      } catch {
        finish()
        reject(new Error('Upload returned an invalid response'))
        return
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        finish()
        reject(new Error(data.error ?? 'Upload failed'))
        return
      }
      if (!data.url) {
        finish()
        reject(new Error('Upload failed'))
        return
      }
      onProgress?.(100)
      finish()
      resolve(data)
    }
    xhr.send(body)
  })
}

/** Read image pixel size in the browser (no upload). */
export function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const width = img.naturalWidth
      const height = img.naturalHeight
      URL.revokeObjectURL(url)
      resolve({ width, height })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image dimensions'))
    }
    img.src = url
  })
}
