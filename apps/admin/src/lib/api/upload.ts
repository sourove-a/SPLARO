export type UploadAdminImageOptions = {
  /** Product pipeline ON/OFF. Only applied when folder is `products`. Default true. */
  pipeline?: boolean
  /** Legacy single-file optimize (non-product or pipeline off). Default true. */
  optimize?: boolean
  /** Approved AI upscale preview id — variants built from upscaled buffer; original file kept. */
  upscalePreviewId?: string
}

export type UploadAdminImageResult = {
  url: string
  pipeline?: boolean
  warning?: string
  sourceWidth?: number
  aiUpscaled?: boolean
  originalUrl?: string
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
  if (!url.includes('/uploads/products/')) return
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

export async function uploadAdminImage(
  file: File,
  folder = 'products',
  options: UploadAdminImageOptions = {},
): Promise<UploadAdminImageResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('folder', folder)
  form.append('optimize', options.optimize === false ? '0' : '1')
  if (folder === 'products') {
    form.append('pipeline', options.pipeline === false ? '0' : '1')
    if (options.upscalePreviewId) {
      form.append('upscalePreviewId', options.upscalePreviewId)
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90_000)
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: form, signal: controller.signal })
    const data = (await res.json()) as UploadAdminImageResult & { error?: string }
    if (!res.ok) throw new Error(data.error ?? 'Upload failed')
    if (!data.url) throw new Error('Upload failed')
    return {
      url: data.url,
      ...(data.pipeline !== undefined ? { pipeline: data.pipeline } : {}),
      ...(data.warning ? { warning: data.warning } : {}),
      ...(data.sourceWidth !== undefined ? { sourceWidth: data.sourceWidth } : {}),
      ...(data.aiUpscaled !== undefined ? { aiUpscaled: data.aiUpscaled } : {}),
      ...(data.originalUrl ? { originalUrl: data.originalUrl } : {}),
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Upload timed out — try a smaller image or wait and retry.')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
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
