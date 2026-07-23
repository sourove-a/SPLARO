import path from 'path'
import { mkdir, rename, unlink, writeFile } from 'fs/promises'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/auth/session'
import {
  MIN_PRODUCT_WIDTH,
  clearUpscalePreview,
  loadUpscalePreview,
  uploadRoot,
} from '@/lib/upload/product-ai-upscale'
import { withProductPipelineSlot } from '@/lib/upload/product-pipeline-queue'

/** Admin upload can wait for Sharp + queue; keep ≥60s. */
export const maxDuration = 90

const MAX_BYTES = 8 * 1024 * 1024
const MAX_PRODUCT_PIPELINE_BYTES = 12 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const ALLOWED_FOLDERS = new Set(['general', 'products', 'partners', 'banners', 'media'])
const PRODUCT_VARIANT_WIDTHS = [160, 480, 828, 1200, 1600] as const
const DISPLAY_WIDTH = 1200
const QUALITY_WARN_BELOW = 1200

/** Mild sharpen after downscale only — never applied to the original file. */
function sharpenForWidth(width: number): { sigma: number; m1: number; m2: number } {
  if (width <= 480) return { sigma: 0.7, m1: 0.5, m2: 0.4 }
  if (width <= 828) return { sigma: 0.55, m1: 0.45, m2: 0.35 }
  return { sigma: 0.45, m1: 0.4, m2: 0.3 }
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/** Env master kill switch — default ON. */
function envPipelineEnabled(): boolean {
  const raw = (process.env.PRODUCT_IMAGE_PIPELINE ?? 'true').trim().toLowerCase()
  return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'no'
}

async function optimizeImageLegacy(
  bytes: Buffer,
  ext: string,
): Promise<{ buffer: Buffer; ext: string }> {
  try {
    const sharp = (await import('sharp')).default
    const pipeline = sharp(bytes).rotate().resize(1600, 1600, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    if (ext === 'png') {
      return { buffer: await pipeline.png({ compressionLevel: 8 }).toBuffer(), ext: 'png' }
    }
    return { buffer: await pipeline.webp({ quality: 82 }).toBuffer(), ext: 'webp' }
  } catch {
    return { buffer: bytes, ext }
  }
}

async function removeQuiet(filePath: string) {
  try {
    await unlink(filePath)
  } catch {
    /* ignore */
  }
}

type PipelineResult = {
  url: string
  originalUrl: string
  variants: Record<string, string>
  avifVariants: Record<string, string>
  pipeline: boolean
  sourceWidth: number
  warning?: string
  aiUpscaled?: boolean
}

/**
 * Product pipeline: keep original + write WebP + AVIF sizes (sequential, atomic rename).
 * When `variantSource` is set (AI-upscaled), variants come from that buffer;
 * `{id}.original.*` is always the raw upload. Original never overwritten.
 */
async function runProductPipeline(
  bytes: Buffer,
  ext: string,
  dir: string,
  id: string,
  variantSource?: Buffer,
): Promise<PipelineResult> {
  const sharp = (await import('sharp')).default
  const meta = await sharp(bytes).metadata()
  const width = meta.width ?? 0
  const sourceForVariants = variantSource ?? bytes
  const variantMeta = await sharp(sourceForVariants).metadata()
  const variantWidth = variantMeta.width ?? 0

  if (!variantSource && width < MIN_PRODUCT_WIDTH) {
    throw new Error(
      `Product photo too small (min ${MIN_PRODUCT_WIDTH}px wide). Upload a larger original or use AI upscale.`,
    )
  }
  if (variantSource && variantWidth < MIN_PRODUCT_WIDTH) {
    throw new Error(
      `Upscaled image still too small (min ${MIN_PRODUCT_WIDTH}px). Try a larger source photo.`,
    )
  }

  const originalName = `${id}.original.${ext}`
  const originalPath = path.join(dir, originalName)
  await writeFile(originalPath, bytes)
  const originalUrl = `/uploads/products/${originalName}`

  const qualityNote =
    width < QUALITY_WARN_BELOW && !variantSource
      ? `Image accepted (${width}px), but 1200px+ is recommended for gallery quality.`
      : variantSource && variantWidth < QUALITY_WARN_BELOW
        ? `Upscaled to ${variantWidth}px — 1200px+ still preferred for gallery quality.`
        : undefined

  const tmpPaths: string[] = []
  const pendingRenames: Array<{ tmp: string; final: string }> = []

  try {
    if (variantSource) {
      const upscaledTmp = path.join(dir, `${id}.upscaled.tmp.png`)
      const upscaledFinal = path.join(dir, `${id}.upscaled.png`)
      await writeFile(upscaledTmp, variantSource)
      tmpPaths.push(upscaledTmp)
      pendingRenames.push({ tmp: upscaledTmp, final: upscaledFinal })
    }

    const rotated = await sharp(sourceForVariants).rotate().toBuffer()
    const variants: Record<string, string> = {}
    const avifVariants: Record<string, string> = {}

    // Sequential encodes into .tmp.* first — nothing public until all succeed.
    for (const w of PRODUCT_VARIANT_WIDTHS) {
      const resized = sharp(rotated)
        .resize(w, w, { fit: 'inside', withoutEnlargement: true })
        .sharpen(sharpenForWidth(w))

      const webpTmp = path.join(dir, `${id}.w${w}.tmp.webp`)
      const webpFinal = path.join(dir, `${id}.w${w}.webp`)
      const webpBuf = await resized
        .clone()
        .webp({ quality: w >= 1200 ? 86 : 82 })
        .toBuffer()
      await writeFile(webpTmp, webpBuf)
      tmpPaths.push(webpTmp)
      pendingRenames.push({ tmp: webpTmp, final: webpFinal })
      variants[String(w)] = `/uploads/products/${id}.w${w}.webp`

      try {
        const avifTmp = path.join(dir, `${id}.w${w}.tmp.avif`)
        const avifFinal = path.join(dir, `${id}.w${w}.avif`)
        const avifBuf = await resized
          .clone()
          .avif({ quality: w >= 1200 ? 58 : 52, effort: 4 })
          .toBuffer()
        await writeFile(avifTmp, avifBuf)
        tmpPaths.push(avifTmp)
        pendingRenames.push({ tmp: avifTmp, final: avifFinal })
        avifVariants[String(w)] = `/uploads/products/${id}.w${w}.avif`
      } catch {
        // AVIF optional — WebP tmp already queued for this width.
      }
    }

    // Atomic publish: rename all temps only after every required encode succeeded.
    for (const { tmp, final } of pendingRenames) {
      await rename(tmp, final)
    }

    const display = variants[String(DISPLAY_WIDTH)] ?? variants['1600'] ?? originalUrl
    return {
      url: display,
      originalUrl,
      variants,
      avifVariants,
      pipeline: true,
      sourceWidth: width,
      ...(qualityNote ? { warning: qualityNote } : {}),
      ...(variantSource ? { aiUpscaled: true } : {}),
    }
  } catch {
    // Incomplete set must not stay public — drop all temps; keep original only.
    for (const filePath of tmpPaths) {
      await removeQuiet(filePath)
    }
    for (const { final } of pendingRenames) {
      await removeQuiet(final)
    }
    return {
      url: originalUrl,
      originalUrl,
      variants: {},
      avifVariants: {},
      pipeline: false,
      sourceWidth: width,
      warning: 'Image optimization failed; original was saved.',
      ...(variantSource ? { aiUpscaled: true } : {}),
    }
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  const session = token ? await verifyAdminSessionToken(token) : null
  if (!session) {
    return NextResponse.json({ error: 'Sign in to upload files' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = form.get('file')
  const requestedFolder = String(form.get('folder') ?? 'general').replace(/[^a-z0-9-_]/gi, '')
  const folder = ALLOWED_FOLDERS.has(requestedFolder) ? requestedFolder : 'general'
  const optimize = form.get('optimize') === '1'
  const pipelineRequested = form.get('pipeline') !== '0' && form.get('pipeline') !== 'false'
  const upscalePreviewId = String(form.get('upscalePreviewId') ?? '').trim()
  const useProductPipeline =
    folder === 'products' &&
    envPipelineEnabled() &&
    pipelineRequested &&
    file instanceof File &&
    file.type !== 'image/gif'

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 })
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Only JPG, PNG, WebP or GIF allowed' }, { status: 400 })
  }

  const maxBytes = useProductPipeline ? MAX_PRODUCT_PIPELINE_BYTES : MAX_BYTES
  if (file.size > maxBytes) {
    return NextResponse.json(
      {
        error: useProductPipeline
          ? 'Max product image size is 12MB'
          : 'Max file size is 8MB',
      },
      { status: 400 },
    )
  }

  let ext = MIME_EXT[file.type] ?? 'jpg'
  let bytes = Buffer.from(await file.arrayBuffer()) as Buffer
  const dir = path.join(uploadRoot(), folder)
  await mkdir(dir, { recursive: true })
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  if (useProductPipeline) {
    try {
      const result = await withProductPipelineSlot(async () => {
        let variantSource: Buffer | undefined
        if (upscalePreviewId) {
          const preview = await loadUpscalePreview(upscalePreviewId)
          if (!preview) {
            throw new Error('AI upscale preview expired or missing — generate preview again.')
          }
          variantSource = preview.buffer
        }
        return runProductPipeline(bytes, ext, dir, id, variantSource)
      })
      if (upscalePreviewId) await clearUpscalePreview(upscalePreviewId)
      return NextResponse.json({
        ...result,
        path: result.url,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Product image processing failed'
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }

  // Legacy path — banners / partners / media / pipeline OFF / gif
  if (optimize && file.type !== 'image/gif') {
    const result = await optimizeImageLegacy(bytes, ext)
    bytes = Buffer.from(result.buffer)
    ext = result.ext
  }

  const safeName = `${id}.${ext}`
  await writeFile(path.join(dir, safeName), bytes)
  const url = `/uploads/${folder}/${safeName}`
  return NextResponse.json({ url, path: url, pipeline: false })
}
