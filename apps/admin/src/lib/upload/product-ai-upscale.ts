import path from 'path'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'

/** Offer AI upscale when shorter than this (px). */
export const UPSCALE_OFFER_BELOW = 1200
/** Pipeline without upscale still requires this. */
export const MIN_PRODUCT_WIDTH = 800
/** Absolute floor even with AI upscale. */
export const MIN_UPSCALE_INPUT_WIDTH = 400
/** Cap AI output so variants stay sane. */
export const MAX_UPSCALED_WIDTH = 2400

const REPLICATE_MODEL_VERSION =
  'f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa'

function envFlagOn(raw: string | undefined, defaultOn: boolean): boolean {
  if (raw == null || raw.trim() === '') return defaultOn
  const v = raw.trim().toLowerCase()
  return v !== '0' && v !== 'false' && v !== 'off' && v !== 'no'
}

export function replicateToken(): string | null {
  const t = (process.env.REPLICATE_API_TOKEN ?? '').trim()
  return t || null
}

/** Master switch + token. Default ON when token present. */
export function isAiUpscaleConfigured(): boolean {
  const token = replicateToken()
  if (!token) return false
  return envFlagOn(process.env.PRODUCT_IMAGE_AI_UPSCALE, true)
}

export function aiUpscaleStatus(): {
  available: boolean
  reason: string | null
  offerBelow: number
  minWithoutUpscale: number
  minWithUpscale: number
} {
  if (!replicateToken()) {
    return {
      available: false,
      reason: 'Add REPLICATE_API_TOKEN to enable AI upscale (Real-ESRGAN via Replicate).',
      offerBelow: UPSCALE_OFFER_BELOW,
      minWithoutUpscale: MIN_PRODUCT_WIDTH,
      minWithUpscale: MIN_UPSCALE_INPUT_WIDTH,
    }
  }
  if (!envFlagOn(process.env.PRODUCT_IMAGE_AI_UPSCALE, true)) {
    return {
      available: false,
      reason: 'PRODUCT_IMAGE_AI_UPSCALE is off.',
      offerBelow: UPSCALE_OFFER_BELOW,
      minWithoutUpscale: MIN_PRODUCT_WIDTH,
      minWithUpscale: MIN_UPSCALE_INPUT_WIDTH,
    }
  }
  return {
    available: true,
    reason: null,
    offerBelow: UPSCALE_OFFER_BELOW,
    minWithoutUpscale: MIN_PRODUCT_WIDTH,
    minWithUpscale: MIN_UPSCALE_INPUT_WIDTH,
  }
}

export function uploadRoot() {
  if (process.env.UPLOAD_DIR) return process.env.UPLOAD_DIR
  return path.join(process.cwd(), '..', 'web', 'public', 'uploads')
}

export function upscaleTmpDir() {
  return path.join(uploadRoot(), 'tmp')
}

type PreviewMeta = {
  previewId: string
  createdAt: number
  originalExt: string
  upscaledWidth: number
  upscaledHeight: number
  method: 'replicate-real-esrgan'
}

function metaPath(previewId: string) {
  return path.join(upscaleTmpDir(), `${previewId}.meta.json`)
}

function upscaledPath(previewId: string) {
  return path.join(upscaleTmpDir(), `${previewId}.upscaled.png`)
}

async function removeQuiet(filePath: string) {
  try {
    await unlink(filePath)
  } catch {
    /* ignore */
  }
}

export async function clearUpscalePreview(previewId: string) {
  const id = previewId.replace(/[^a-zA-Z0-9-_]/g, '')
  if (!id) return
  await removeQuiet(upscaledPath(id))
  await removeQuiet(metaPath(id))
}

export async function loadUpscalePreview(previewId: string): Promise<{
  buffer: Buffer
  meta: PreviewMeta
} | null> {
  const id = previewId.replace(/[^a-zA-Z0-9-_]/g, '')
  if (!id) return null
  try {
    const metaRaw = await readFile(metaPath(id), 'utf8')
    const meta = JSON.parse(metaRaw) as PreviewMeta
    // Expire after 30 minutes
    if (Date.now() - meta.createdAt > 30 * 60 * 1000) {
      await clearUpscalePreview(id)
      return null
    }
    const buffer = await readFile(upscaledPath(id))
    return { buffer, meta }
  } catch {
    return null
  }
}

async function pollPrediction(
  getUrl: string,
  token: string,
  deadlineMs: number,
): Promise<string> {
  while (Date.now() < deadlineMs) {
    const res = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Replicate poll failed (${res.status}): ${text.slice(0, 200)}`)
    }
    const body = (await res.json()) as {
      status?: string
      output?: string | string[] | null
      error?: string | null
    }
    if (body.status === 'succeeded') {
      const out = body.output
      const url = Array.isArray(out) ? out[0] : out
      if (typeof url !== 'string' || !url) {
        throw new Error('Replicate returned no image URL')
      }
      return url
    }
    if (body.status === 'failed' || body.status === 'canceled') {
      throw new Error(body.error || `Replicate ${body.status}`)
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error('AI upscale timed out — try again or upload without upscale.')
}

/**
 * Real-ESRGAN via Replicate (cloud GPU — does not melt Contabo CPU).
 * Returns PNG buffer + dimensions.
 */
export async function runReplicateUpscale(
  bytes: Buffer,
  mime: string,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const token = replicateToken()
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set')

  const dataUri = `data:${mime};base64,${bytes.toString('base64')}`
  const createRes = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait=60',
    },
    body: JSON.stringify({
      version: REPLICATE_MODEL_VERSION,
      input: {
        image: dataUri,
        scale: 2,
        face_enhance: false,
      },
    }),
  })

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => '')
    throw new Error(`Replicate error (${createRes.status}): ${text.slice(0, 240)}`)
  }

  const created = (await createRes.json()) as {
    status?: string
    output?: string | string[] | null
    error?: string | null
    urls?: { get?: string }
  }

  let outputUrl: string
  if (created.status === 'succeeded') {
    const out = created.output
    const url = Array.isArray(out) ? out[0] : out
    if (typeof url !== 'string' || !url) throw new Error('Replicate returned no image URL')
    outputUrl = url
  } else if (created.urls?.get) {
    outputUrl = await pollPrediction(created.urls.get, token, Date.now() + 90_000)
  } else if (created.error) {
    throw new Error(created.error)
  } else {
    throw new Error('Replicate did not return a result')
  }

  const imgRes = await fetch(outputUrl, { cache: 'no-store' })
  if (!imgRes.ok) throw new Error('Failed to download upscaled image from Replicate')
  let buffer = Buffer.from(await imgRes.arrayBuffer())

  const sharp = (await import('sharp')).default
  let meta = await sharp(buffer).metadata()
  let width = meta.width ?? 0
  let height = meta.height ?? 0

  if (width > MAX_UPSCALED_WIDTH) {
    buffer = Buffer.from(
      await sharp(buffer)
        .resize(MAX_UPSCALED_WIDTH, MAX_UPSCALED_WIDTH, { fit: 'inside', withoutEnlargement: true })
        .png({ compressionLevel: 8 })
        .toBuffer(),
    )
    meta = await sharp(buffer).metadata()
    width = meta.width ?? 0
    height = meta.height ?? 0
  } else if (meta.format !== 'png') {
    buffer = Buffer.from(await sharp(buffer).png({ compressionLevel: 8 }).toBuffer())
  }

  return { buffer, width, height }
}

export async function createUpscalePreview(opts: {
  bytes: Buffer
  mime: string
  originalExt: string
}): Promise<{
  previewId: string
  previewUrl: string
  width: number
  height: number
  method: 'replicate-real-esrgan'
}> {
  if (!isAiUpscaleConfigured()) {
    throw new Error(aiUpscaleStatus().reason ?? 'AI upscale is not configured')
  }

  const { buffer, width, height } = await runReplicateUpscale(opts.bytes, opts.mime)
  const previewId = `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const dir = upscaleTmpDir()
  await mkdir(dir, { recursive: true })
  await writeFile(upscaledPath(previewId), buffer)
  const meta: PreviewMeta = {
    previewId,
    createdAt: Date.now(),
    originalExt: opts.originalExt,
    upscaledWidth: width,
    upscaledHeight: height,
    method: 'replicate-real-esrgan',
  }
  await writeFile(metaPath(previewId), JSON.stringify(meta))

  return {
    previewId,
    previewUrl: `/uploads/tmp/${previewId}.upscaled.png`,
    width,
    height,
    method: 'replicate-real-esrgan',
  }
}
