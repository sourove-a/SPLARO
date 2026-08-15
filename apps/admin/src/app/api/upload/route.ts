import path from 'path'
import { createHash } from 'crypto'
import { mkdir, rename, stat, unlink, writeFile } from 'fs/promises'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { resolvePublicSiteUrl } from '@splaro/config'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/auth/session'
import {
  MIN_PRODUCT_WIDTH,
  clearUpscalePreview,
  loadUpscalePreview,
  uploadRoot,
} from '@/lib/upload/product-ai-upscale'
import { withProductPipelineSlot } from '@/lib/upload/product-pipeline-queue'
import { deleteProductPipelineFiles } from '@/lib/upload/product-pipeline-cleanup'

/** Admin upload can wait for Sharp + queue; keep ≥60s. */
export const maxDuration = 90

const MAX_BYTES = 8 * 1024 * 1024
const MAX_PRODUCT_PIPELINE_BYTES = 12 * 1024 * 1024
const MAX_PDF_BYTES = 20 * 1024 * 1024
const MAX_VIDEO_BYTES = 40 * 1024 * 1024
const RASTER = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
const LIBRARY_ONLY = new Set(['image/svg+xml', 'application/pdf', 'video/mp4', 'video/webm'])
const ALLOWED = new Set([...RASTER, ...LIBRARY_ONLY])
const ALLOWED_FOLDERS = new Set([
  'general',
  'products',
  'products-men',
  'products-women',
  'products-kids',
  'products-footwear',
  'products-accessories',
  'partners',
  'banners',
  'media',
  'wholesale',
])

function isProductFolder(folder: string): boolean {
  return folder === 'products' || folder.startsWith('products-')
}
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
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

function sniffMime(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png'
  }
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp'
  }
  if (bytes.length >= 6) {
    const signature = bytes.subarray(0, 6).toString('ascii')
    if (signature === 'GIF87a' || signature === 'GIF89a') return 'image/gif'
  }
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = bytes.subarray(8, 12).toString('ascii')
    if (brand.startsWith('avif') || brand.startsWith('avis')) return 'image/avif'
    if (brand.startsWith('isom') || brand.startsWith('mp41') || brand.startsWith('mp42') || brand.startsWith('M4V')) {
      return 'video/mp4'
    }
  }
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return 'video/webm'
  }
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf'
  const head = bytes.subarray(0, Math.min(bytes.length, 256)).toString('utf8').trimStart().toLowerCase()
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml'
  return null
}

function sanitizeSvg(bytes: Buffer): Buffer {
  const text = bytes.toString('utf8')
  if (/<script|javascript:|on\w+\s*=/i.test(text)) {
    throw new Error('SVG contains executable markup and was rejected')
  }
  return bytes
}

async function maybeWatermark(bytes: Buffer, ext: string): Promise<Buffer> {
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return bytes
  try {
    const { readFile } = await import('fs/promises')
    const logo = path.resolve(process.cwd(), '..', 'web', 'public', 'images', 'logo', 'splaro-logo-dark.svg')
    const mark = await readFile(logo)
    const sharp = (await import('sharp')).default
    const base = sharp(bytes).rotate()
    const meta = await base.metadata()
    const width = meta.width ?? 800
    const overlay = await sharp(mark)
      .resize(Math.max(48, Math.round(width * 0.18)), null, { fit: 'inside' })
      .png()
      .toBuffer()
    return await base
      .composite([{ input: overlay, gravity: 'southeast', blend: 'over' }])
      .toFormat(ext === 'png' ? 'png' : 'webp')
      .toBuffer()
  } catch {
    return bytes
  }
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
  sourceHeight: number
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
  urlFolder = 'products',
): Promise<PipelineResult> {
  const sharp = (await import('sharp')).default
  const meta = await sharp(bytes).metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const sourceForVariants = variantSource ?? bytes
  const variantMeta = await sharp(sourceForVariants).metadata()
  const variantWidth = variantMeta.width ?? 0
  const urlBase = `/uploads/${urlFolder}`

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
  const originalUrl = `${urlBase}/${originalName}`

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
      variants[String(w)] = `${urlBase}/${id}.w${w}.webp`

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
        avifVariants[String(w)] = `${urlBase}/${id}.w${w}.avif`
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
      sourceHeight: height,
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
      sourceHeight: height,
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
  const rawFolder = String(form.get('folder') ?? 'general').trim()
  const requestedFolder = rawFolder.replace(/[^a-z0-9-_]/gi, '')
  if (requestedFolder !== rawFolder || !ALLOWED_FOLDERS.has(requestedFolder)) {
    return NextResponse.json({ error: 'Unsupported upload folder' }, { status: 400 })
  }
  const folder = requestedFolder
  const optimize = form.get('optimize') === '1'
  const pipelineRequested = form.get('pipeline') !== '0' && form.get('pipeline') !== 'false'
  const upscalePreviewId = String(form.get('upscalePreviewId') ?? '').trim()
  const requestedUploadId = String(form.get('uploadId') ?? '').trim().toLowerCase()
  if (requestedUploadId && !/^[0-9]{10,}-[a-z0-9]{8,32}$/.test(requestedUploadId)) {
    return NextResponse.json({ error: 'Invalid upload id' }, { status: 400 })
  }
  const watermark = form.get('watermark') === '1' || form.get('watermark') === 'true'
  const useProductPipeline =
    isProductFolder(folder) &&
    envPipelineEnabled() &&
    pipelineRequested &&
    file instanceof File &&
    (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 })
  }

  let bytes = Buffer.from(await file.arrayBuffer()) as Buffer
  const detectedMime = sniffMime(bytes)
  if (!detectedMime || !ALLOWED.has(detectedMime)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  }
  if (file.type && file.type !== detectedMime && !(file.type === 'image/svg+xml' && detectedMime === 'image/svg+xml')) {
    if (file.type !== 'application/octet-stream' && file.type !== detectedMime) {
      return NextResponse.json({ error: 'File content does not match its type' }, { status: 400 })
    }
  }
  if (isProductFolder(folder) && !RASTER.has(detectedMime)) {
    return NextResponse.json({ error: 'Product photos must be JPG, PNG, WebP or GIF' }, { status: 400 })
  }
  if (detectedMime === 'image/svg+xml') {
    try {
      bytes = Buffer.from(sanitizeSvg(bytes))
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Invalid SVG' }, { status: 400 })
    }
  }

  const maxBytes = useProductPipeline
    ? MAX_PRODUCT_PIPELINE_BYTES
    : detectedMime === 'application/pdf'
      ? MAX_PDF_BYTES
      : detectedMime.startsWith('video/')
        ? MAX_VIDEO_BYTES
        : MAX_BYTES
  if (file.size > maxBytes) {
    return NextResponse.json({ error: `Max file size is ${Math.round(maxBytes / (1024 * 1024))}MB` }, { status: 400 })
  }

  const contentHash = createHash('sha256').update(bytes).digest('hex')
  let ext = MIME_EXT[detectedMime] ?? 'bin'
  const raster = RASTER.has(detectedMime) && detectedMime !== 'image/gif' && detectedMime !== 'image/avif'
  const dir = path.join(uploadRoot(), folder)
  await mkdir(dir, { recursive: true })
  const id = requestedUploadId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const pendingMarker = path.join(dir, `${id}.pending`)
  await writeFile(pendingMarker, '')

  try {
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
        return runProductPipeline(bytes, ext, dir, id, variantSource, folder)
      })
      if (upscalePreviewId) await clearUpscalePreview(upscalePreviewId)
      if (request.signal.aborted) {
        await deleteProductPipelineFiles(result.url)
        return NextResponse.json({ error: 'Upload cancelled' }, { status: 499 })
      }
      const outputPath = path.join(dir, path.basename(result.url))
      let outputSize = file.size
      let outputWidth = result.sourceWidth
      let outputHeight = result.sourceHeight
      try {
        const [outputStat, outputMeta] = await Promise.all([
          stat(outputPath),
          (async () => {
            const sharp = (await import('sharp')).default
            return sharp(outputPath).metadata()
          })(),
        ])
        outputSize = outputStat.size
        outputWidth = outputMeta.width ?? outputWidth
        outputHeight = outputMeta.height ?? outputHeight
      } catch {
        // Output already exists; source metadata is safer than reporting upload failure and orphaning it.
      }
      return NextResponse.json({
        ...result,
        path: result.url,
        publicUrl: `${resolvePublicSiteUrl()}${result.url}`,
        width: outputWidth,
        height: outputHeight,
        sizeBytes: outputSize,
        mimeType: result.url.endsWith('.webp') ? 'image/webp' : file.type,
        contentHash,
        kind: 'image',
        watermarked: false,
      })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Product image processing failed'
        return NextResponse.json({ error: message }, { status: 400 })
      }
    }

    // Legacy path — banners / partners / media / pipeline OFF / gif / files
    let watermarked = false
    if (optimize && raster) {
      const result = await optimizeImageLegacy(bytes, ext)
      bytes = Buffer.from(result.buffer)
      ext = result.ext
    }
    if (watermark && raster) {
      const marked = await maybeWatermark(bytes, ext === 'jpeg' ? 'jpg' : ext)
      if (marked !== bytes && marked.length > 0) {
        bytes = Buffer.from(marked)
        watermarked = true
        if (ext !== 'png') ext = 'webp'
      }
    }

    const safeName = `${id}.${ext}`
    const outputFile = path.join(dir, safeName)
    await writeFile(outputFile, bytes)
    if (request.signal.aborted) {
      await unlink(outputFile).catch(() => undefined)
      return NextResponse.json({ error: 'Upload cancelled' }, { status: 499 })
    }
    const url = `/uploads/${folder}/${safeName}`
    let width: number | null = null
    let height: number | null = null
    if (raster || detectedMime === 'image/gif' || detectedMime === 'image/avif') {
      try {
        const sharp = (await import('sharp')).default
        const metadata = await sharp(bytes).metadata()
        width = metadata.width ?? null
        height = metadata.height ?? null
      } catch {
        // decoder metadata is optional
      }
    }
    const mimeType =
      ext === 'webp' ? 'image/webp' : ext === 'png' ? 'image/png' : detectedMime
    const kind =
      mimeType === 'image/gif'
        ? 'gif'
        : mimeType === 'image/svg+xml'
          ? 'svg'
          : mimeType === 'application/pdf'
            ? 'pdf'
            : mimeType.startsWith('video/')
              ? 'video'
              : mimeType.startsWith('image/')
                ? 'image'
                : 'other'
    return NextResponse.json({
      url,
      path: url,
      publicUrl: `${resolvePublicSiteUrl()}${url}`,
      pipeline: false,
      width,
      height,
      sizeBytes: bytes.length,
      mimeType,
      contentHash,
      kind,
      watermarked,
    })
  } finally {
    await unlink(pendingMarker).catch(() => undefined)
  }
}
