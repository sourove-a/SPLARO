import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

export const maxDuration = 60

const MAX_BYTES = 4 * 1024 * 1024
const MAX_FILES = 4
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

function uploadRoot() {
  if (process.env.UPLOAD_DIR) return process.env.UPLOAD_DIR
  return path.join(process.cwd(), 'public', 'uploads')
}

function safeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * `File.type` is attacker-controlled on a public endpoint — trust the magic bytes
 * instead, so a non-image payload can never be written under an image extension.
 */
function sniffImageMime(bytes: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 8 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png'
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

/**
 * Public wholesale reference-photo upload.
 * Saves under /uploads/wholesale/*.webp — rate-limited, size-capped, no auth
 * (same trust model as the enquiry form itself).
 */
export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'wholesale-images'), 12, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many uploads — please wait a minute.', retryAfter: limit.retryAfter },
      { status: 429 },
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid upload body' }, { status: 400 })
  }

  const files = form
    .getAll('images')
    .filter((entry): entry is File => typeof File !== 'undefined' && entry instanceof File)
  if (files.length === 0) {
    return NextResponse.json({ error: 'Add at least one image.' }, { status: 400 })
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} images.` }, { status: 400 })
  }

  const dir = path.join(uploadRoot(), 'wholesale')
  await mkdir(dir, { recursive: true })

  const urls: string[] = []
  for (const file of files) {
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: 'Use JPG, PNG, or WebP only.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Each image must be under 4 MB.' }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    if (!sniffImageMime(bytes)) {
      return NextResponse.json({ error: 'Use JPG, PNG, or WebP only.' }, { status: 400 })
    }

    let out: Buffer
    const ext = 'webp'
    try {
      const sharp = (await import('sharp')).default
      out = Buffer.from(
        await sharp(bytes)
          .rotate()
          .resize(1400, 1400, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer(),
      )
    } catch {
      // Re-encode is the only thing that guarantees the stored bytes are an image.
      return NextResponse.json(
        { error: 'Could not process that image — try a different file.' },
        { status: 400 },
      )
    }

    const name = `${safeId()}.${ext}`
    await writeFile(path.join(dir, name), out)
    urls.push(`/uploads/wholesale/${name}`)
  }

  return NextResponse.json({ ok: true, urls })
}
