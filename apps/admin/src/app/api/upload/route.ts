import path from 'path'
import { createHash } from 'crypto'
import { createWriteStream } from 'fs'
import { copyFile, mkdir, readFile, rename, stat, unlink, writeFile } from 'fs/promises'
import { Readable, Transform } from 'stream'
import { pipeline as streamPipeline } from 'stream/promises'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { resolvePublicSiteUrl } from '@splaro/config'
import { syncToR2, syncManyToR2 } from '@/lib/upload/r2-sync'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/auth/session'
import {
  MIN_PRODUCT_WIDTH,
  clearUpscalePreview,
  loadUpscalePreview,
  uploadRoot,
} from '@/lib/upload/product-ai-upscale'
import {
  ARCHIVE_QUALITY,
  archiveMaxWidth,
  archivePlan,
  envKeepRawOriginal,
} from '@/lib/upload/archive-original'
import { withProductPipelineSlot } from '@/lib/upload/product-pipeline-queue'
import { deleteProductPipelineFiles } from '@/lib/upload/product-pipeline-cleanup'

/**
 * A 100MB upload on a domestic uplink is minutes of wire time before sharp even
 * starts, so the old 90s ceiling failed large files by design.
 */
export const maxDuration = 900

/**
 * One ceiling for everything — mirrors `MAX_UPLOAD_BYTES` in
 * `apps/admin/src/lib/media/upload-rules.ts`, which rejects earlier so the
 * bytes never leave the browser.
 *
 * nginx must agree: `client_max_body_size` on the admin `/api/upload` location
 * has to sit above this or the request dies at the proxy with a 413.
 */
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024
const MAX_UPLOAD_LABEL = '100MB'
/** Enough for every signature `sniffMime` looks at, including the SVG preamble. */
const HEAD_BYTES = 512
/** ISO base-media brands that mean "this is an MP4", not HEIF/AVIF/QuickTime. */
const MP4_BRANDS = new Set(['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'dash', 'mmp4'])
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
  'brands',
  'media',
  'wholesale',
  'expenses',
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
    // Phone cameras and editors stamp a wider set of ISO-BMFF brands than the
    // three this used to accept; a plain iPhone clip is `iso5`, and a browser
    // recording is often `iso2`. Rejecting those read to the admin as "video
    // uploads are broken".
    if (MP4_BRANDS.has(brand.slice(0, 4)) || brand.startsWith('M4V')) return 'video/mp4'
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

/**
 * Sharp, configured for the host it actually runs on.
 *
 * libvips defaults its thread pool to the CPU count, which on the CloudLinux
 * box is well past the process thread limit — the encode either thrashes or
 * dies. One worker is both what the host allows and, in practice, faster.
 */
async function loadSharp() {
  const sharp = (await import('sharp')).default
  const requested = Number(process.env.SHARP_CONCURRENCY ?? '1')
  sharp.concurrency(Number.isFinite(requested) && requested > 0 ? requested : 1)
  sharp.cache(false)
  return sharp
}

/** Guard against a decompression bomb: 100MB of JPEG can be a great many pixels. */
const SHARP_READ = { sequentialRead: true, limitInputPixels: 120_000_000 } as const

async function watermarkOverlay(width: number): Promise<Buffer> {
  const logo = path.resolve(process.cwd(), '..', 'web', 'public', 'images', 'logo', 'splaro-logo-dark.svg')
  const mark = await readFile(logo)
  const sharp = await loadSharp()
  return sharp(mark)
    .resize(Math.max(48, Math.round(width * 0.18)), null, { fit: 'inside' })
    .png()
    .toBuffer()
}

/** Env master kill switch — default ON. */
function envPipelineEnabled(): boolean {
  const raw = (process.env.PRODUCT_IMAGE_PIPELINE ?? 'true').trim().toLowerCase()
  return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'no'
}

/**
 * Write the copy of the upload that outlives the request.
 *
 * Squeezing it is the whole saving, so the one thing this must never do is
 * fail the upload to get it: a sharp that cannot read the file, a master that
 * comes out no smaller than the raw bytes, a photo already small enough to be
 * cheap — every one of those falls back to copying what was uploaded, which is
 * exactly the behaviour this replaced.
 *
 * Returns the file name written into `dir`.
 */
async function writeArchivedOriginal(
  srcPath: string,
  dir: string,
  id: string,
  ext: string,
  sourceWidth: number,
): Promise<string> {
  const rawName = `${id}.original.${ext}`
  const copyRaw = async () => {
    await copyFile(srcPath, path.join(dir, rawName))
    return rawName
  }
  if (envKeepRawOriginal()) return copyRaw()

  const maxWidth = archiveMaxWidth()
  let rawBytes = 0
  try {
    rawBytes = (await stat(srcPath)).size
  } catch {
    return copyRaw()
  }
  if (archivePlan({ ext, rawBytes, sourceWidth, maxWidth }).strategy === 'raw') {
    return copyRaw()
  }

  const masterName = `${id}.original.webp`
  // Named `.original.tmp` rather than `.original.tmp.webp` so that a crash
  // between encode and rename leaves something both `deleteProductPipelineFiles`
  // and the storage sweep recognise as a derivative. sharp writes WebP here
  // because `.webp()` is set explicitly, not because of the extension.
  const masterTmp = path.join(dir, `${id}.original.tmp`)
  try {
    const sharp = await loadSharp()
    await sharp(srcPath, SHARP_READ)
      .rotate()
      .resize(maxWidth, maxWidth, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: ARCHIVE_QUALITY, effort: 5 })
      .toFile(masterTmp)
    const masterBytes = (await stat(masterTmp)).size
    // A small PNG logo or an already-tuned WebP can encode larger than it
    // arrived. Keeping the bigger file would be the opposite of the point.
    if (masterBytes >= rawBytes) {
      await removeQuiet(masterTmp)
      return copyRaw()
    }
    await rename(masterTmp, path.join(dir, masterName))
    return masterName
  } catch {
    await removeQuiet(masterTmp)
    return copyRaw()
  }
}

/**
 * Resize and/or watermark a raster in a single sharp pass, straight from the
 * staged file to its final name.
 *
 * These used to be two calls, each decoding and re-encoding the whole image and
 * each holding its own copy in memory — a watermarked upload paid for two full
 * round trips through libvips. One pipeline reads the file once and writes the
 * result once.
 *
 * Returns null when sharp cannot handle the file, which is the caller's cue to
 * publish the original untouched rather than fail the upload.
 */
async function writeProcessedRaster(
  srcPath: string,
  destDir: string,
  id: string,
  ext: string,
  options: { optimize: boolean; watermark: boolean },
): Promise<{ ext: string; file: string; watermarked: boolean } | null> {
  const markable = ['jpg', 'jpeg', 'png', 'webp'].includes(ext)
  const applyMark = options.watermark && markable
  if (!options.optimize && !applyMark) return null

  try {
    const sharp = await loadSharp()
    const outExt = ext === 'png' ? 'png' : 'webp'
    const outFile = `${id}.${outExt}`
    const outPath = path.join(destDir, outFile)

    let pipe = sharp(srcPath, SHARP_READ).rotate()
    if (options.optimize) {
      pipe = pipe.resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    }
    if (applyMark) {
      // Width after the resize decides the mark size, so the overlay is the
      // same fraction of the picture no matter how large the original was.
      const meta = await sharp(srcPath, SHARP_READ).metadata()
      const sourceWidth = meta.width ?? 800
      const finalWidth = options.optimize ? Math.min(sourceWidth, 1600) : sourceWidth
      pipe = pipe.composite([
        { input: await watermarkOverlay(finalWidth), gravity: 'southeast', blend: 'over' },
      ])
    }
    const encoded = outExt === 'png' ? pipe.png({ compressionLevel: 8 }) : pipe.webp({ quality: 82 })
    await encoded.toFile(outPath)
    return { ext: outExt, file: outFile, watermarked: applyMark }
  } catch {
    return null
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
  srcPath: string,
  ext: string,
  dir: string,
  id: string,
  variantSource?: Buffer,
  urlFolder = 'products',
): Promise<PipelineResult> {
  const sharp = await loadSharp()
  const meta = await sharp(srcPath, SHARP_READ).metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const sourceForVariants: string | Buffer = variantSource ?? srcPath
  const variantMeta = await sharp(sourceForVariants, SHARP_READ).metadata()
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

  const originalName = await writeArchivedOriginal(srcPath, dir, id, ext, width)
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

    const rotated = await sharp(sourceForVariants, SHARP_READ).rotate().toBuffer()
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

class UploadError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

type Staged = {
  /** Where the untouched upload landed. Every later step reads from here. */
  tmpPath: string
  size: number
  contentHash: string
  /** First `HEAD_BYTES`, kept for the magic-number sniff. */
  head: Buffer
}

/**
 * Land the request body on disk without ever holding it whole in memory.
 *
 * The old route did `Buffer.from(await file.arrayBuffer())` on a body Next had
 * already buffered to parse the multipart envelope — two full copies of the
 * upload resident before the first byte reached disk, which is what made large
 * files crawl and then die on a thread-limited box. Hashing and sniffing ride
 * along in the same pass, so nothing has to be re-read afterwards.
 */
async function stageRawBody(body: ReadableStream<Uint8Array>, tmpPath: string): Promise<Staged> {
  const hash = createHash('sha256')
  const headChunks: Buffer[] = []
  let headBytes = 0
  let size = 0

  const meter = new Transform({
    transform(chunk, _encoding, done) {
      const buf = chunk as Buffer
      size += buf.length
      if (size > MAX_UPLOAD_BYTES) {
        done(new UploadError(`Max file size is ${MAX_UPLOAD_LABEL}`, 413))
        return
      }
      hash.update(buf)
      if (headBytes < HEAD_BYTES) {
        const want = HEAD_BYTES - headBytes
        headChunks.push(buf.subarray(0, want))
        headBytes += Math.min(buf.length, want)
      }
      done(null, buf)
    },
  })

  await streamPipeline(Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]), meter, createWriteStream(tmpPath))
  if (size === 0) throw new UploadError('File is required')
  return { tmpPath, size, contentHash: hash.digest('hex'), head: Buffer.concat(headChunks) }
}

/** Same landing, for the multipart callers that have not moved to a raw body. */
async function stageFormFile(file: File, tmpPath: string): Promise<Staged> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(`Max file size is ${MAX_UPLOAD_LABEL}`, 413)
  }
  return stageRawBody(file.stream(), tmpPath)
}

type UploadParams = {
  folder: string
  optimize: boolean
  watermark: boolean
  pipelineRequested: boolean
  upscalePreviewId: string
  uploadId: string
  /** What the client says this is; only ever used to contradict the sniff. */
  declaredType: string
}

function readParams(source: URLSearchParams | FormData, declaredType: string): UploadParams {
  const value = (key: string): string => {
    const raw = source instanceof URLSearchParams ? source.get(key) : source.get(key)
    return typeof raw === 'string' ? raw : ''
  }
  const rawFolder = (value('folder') || 'general').trim()
  const folder = rawFolder.replace(/[^a-z0-9-_]/gi, '')
  if (folder !== rawFolder || !ALLOWED_FOLDERS.has(folder)) {
    throw new UploadError('Unsupported upload folder')
  }
  const uploadId = value('uploadId').trim().toLowerCase()
  if (uploadId && !/^[0-9]{10,}-[a-z0-9]{8,32}$/.test(uploadId)) {
    throw new UploadError('Invalid upload id')
  }
  const pipeline = value('pipeline')
  return {
    folder,
    optimize: value('optimize') === '1',
    watermark: value('watermark') === '1' || value('watermark') === 'true',
    pipelineRequested: pipeline !== '0' && pipeline !== 'false',
    upscalePreviewId: value('upscalePreviewId').trim(),
    uploadId,
    declaredType: declaredType.split(';')[0]?.trim().toLowerCase() ?? '',
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  const session = token ? await verifyAdminSessionToken(token) : null
  if (!session) {
    return NextResponse.json({ error: 'Sign in to upload files' }, { status: 401 })
  }

  const requestUrl = new URL(request.url)
  const contentType = request.headers.get('content-type') ?? ''
  const rawUpload = requestUrl.searchParams.get('raw') === '1' && !contentType.startsWith('multipart/')

  let params: UploadParams
  let formFile: File | null = null
  try {
    if (rawUpload) {
      params = readParams(requestUrl.searchParams, contentType)
    } else {
      let form: FormData
      try {
        form = await request.formData()
      } catch {
        throw new UploadError('Invalid form data')
      }
      const candidate = form.get('file')
      if (!(candidate instanceof File)) throw new UploadError('File is required')
      formFile = candidate
      params = readParams(form, candidate.type)
    }
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }

  const { folder, optimize, watermark, pipelineRequested, upscalePreviewId, declaredType } = params
  const dir = path.join(uploadRoot(), folder)
  await mkdir(dir, { recursive: true })
  const id = params.uploadId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const pendingMarker = path.join(dir, `${id}.pending`)
  await writeFile(pendingMarker, '')
  const tmpPath = path.join(dir, `${id}.upload.tmp`)

  try {
    if (rawUpload && !request.body) throw new UploadError('File is required')
    const staged = rawUpload
      ? await stageRawBody(request.body as ReadableStream<Uint8Array>, tmpPath)
      : await stageFormFile(formFile as File, tmpPath)

    const detectedMime = sniffMime(staged.head)
    if (!detectedMime || !ALLOWED.has(detectedMime)) {
      throw new UploadError('Unsupported file type')
    }
    if (declaredType && declaredType !== detectedMime && declaredType !== 'application/octet-stream') {
      throw new UploadError('File content does not match its type')
    }
    if (isProductFolder(folder) && !RASTER.has(detectedMime)) {
      throw new UploadError('Product photos must be JPG, PNG, WebP or GIF')
    }
    if (folder === 'expenses' && detectedMime !== 'application/pdf' && !RASTER.has(detectedMime)) {
      throw new UploadError('Receipts must be an image or PDF')
    }
    if (detectedMime === 'image/svg+xml') {
      // SVG is the one type whose whole body has to be inspected, and the one
      // type small enough that reading it back costs nothing.
      sanitizeSvg(await readFile(tmpPath))
    }

    const contentHash = staged.contentHash
    let ext = MIME_EXT[detectedMime] ?? 'bin'
    const raster = RASTER.has(detectedMime) && detectedMime !== 'image/gif' && detectedMime !== 'image/avif'
    const useProductPipeline =
      isProductFolder(folder) &&
      envPipelineEnabled() &&
      pipelineRequested &&
      (detectedMime === 'image/jpeg' || detectedMime === 'image/png' || detectedMime === 'image/webp')

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
          return runProductPipeline(tmpPath, ext, dir, id, variantSource, folder)
        })
        if (upscalePreviewId) await clearUpscalePreview(upscalePreviewId)
        if (request.signal.aborted) {
          await deleteProductPipelineFiles(result.url)
          return NextResponse.json({ error: 'Upload cancelled' }, { status: 499 })
        }
        const outputPath = path.join(dir, path.basename(result.url))
        let outputSize = staged.size
        let outputWidth = result.sourceWidth
        let outputHeight = result.sourceHeight
        try {
          const sharp = await loadSharp()
          const [outputStat, outputMeta] = await Promise.all([stat(outputPath), sharp(outputPath).metadata()])
          outputSize = outputStat.size
          outputWidth = outputMeta.width ?? outputWidth
          outputHeight = outputMeta.height ?? outputHeight
        } catch {
          // Output already exists; source metadata is safer than reporting upload failure and orphaning it.
        }
        // R2 sync — background, best-effort
        const r2Files = [
          { localPath: outputPath, storedUrl: result.url, contentType: result.url.endsWith('.webp') ? 'image/webp' : detectedMime },
          ...Object.values(result.variants).map((varUrl) => ({
            localPath: path.join(dir, path.basename(varUrl)),
            storedUrl: varUrl,
            contentType: 'image/webp',
          })),
          ...Object.values(result.avifVariants).map((varUrl) => ({
            localPath: path.join(dir, path.basename(varUrl)),
            storedUrl: varUrl,
            contentType: 'image/avif',
          })),
        ]
        syncManyToR2(r2Files).catch(() => {})

        const r2Url = process.env.CLOUDFLARE_R2_PUBLIC_URL
          ? `${process.env.CLOUDFLARE_R2_PUBLIC_URL.replace(/\/+$/, '')}/${result.url.replace(/^\//, '')}`
          : null

        return NextResponse.json({
          ...result,
          path: result.url,
          publicUrl: r2Url || `${resolvePublicSiteUrl()}${result.url}`,
          r2Url,
          width: outputWidth,
          height: outputHeight,
          sizeBytes: outputSize,
          mimeType: result.url.endsWith('.webp') ? 'image/webp' : detectedMime,
          contentHash,
          kind: 'image',
          watermarked: false,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Product image processing failed'
        return NextResponse.json({ error: message }, { status: 400 })
      }
    }

    // Library path — banners / partners / media / pipeline OFF / gif / files.
    // Anything sharp has no work to do on is published by renaming the staged
    // file, so a 100MB video is written to disk exactly once.
    const processed = raster ? await writeProcessedRaster(tmpPath, dir, id, ext, { optimize, watermark }) : null
    let safeName: string
    let watermarked = false
    if (processed) {
      ext = processed.ext
      safeName = processed.file
      watermarked = processed.watermarked
    } else {
      safeName = `${id}.${ext}`
      await rename(tmpPath, path.join(dir, safeName))
    }

    const outputFile = path.join(dir, safeName)
    if (request.signal.aborted) {
      await removeQuiet(outputFile)
      return NextResponse.json({ error: 'Upload cancelled' }, { status: 499 })
    }
    const url = `/uploads/${folder}/${safeName}`
    let width: number | null = null
    let height: number | null = null
    let outputSize = staged.size
    try {
      outputSize = (await stat(outputFile)).size
    } catch {
      // Size from the wire is close enough if the stat races a sweep.
    }
    if (raster || detectedMime === 'image/gif' || detectedMime === 'image/avif') {
      try {
        const sharp = await loadSharp()
        const metadata = await sharp(outputFile, SHARP_READ).metadata()
        width = metadata.width ?? null
        height = metadata.height ?? null
      } catch {
        // decoder metadata is optional
      }
    }
    const mimeType = ext === 'webp' ? 'image/webp' : ext === 'png' ? 'image/png' : detectedMime
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
    const constructedR2 = process.env.CLOUDFLARE_R2_PUBLIC_URL
      ? `${process.env.CLOUDFLARE_R2_PUBLIC_URL.replace(/\/+$/, '')}/${url.replace(/^\//, '')}`
      : null
    let r2Url = constructedR2
    if (folder === 'expenses') {
      r2Url = (await syncToR2(outputFile, url, mimeType)) ?? constructedR2
    } else {
      void syncToR2(outputFile, url, mimeType)
    }

    return NextResponse.json({
      url,
      path: url,
      publicUrl: r2Url || `${resolvePublicSiteUrl()}${url}`,
      r2Url,
      pipeline: false,
      width,
      height,
      sizeBytes: outputSize,
      mimeType,
      contentHash,
      kind,
      watermarked,
    })
  } catch (err) {
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 400 })
  } finally {
    // The staged copy is gone by rename on the happy path; this catches every
    // other exit, including a body that blew the size cap mid-stream.
    await removeQuiet(tmpPath)
    await unlink(pendingMarker).catch(() => undefined)
  }
}
