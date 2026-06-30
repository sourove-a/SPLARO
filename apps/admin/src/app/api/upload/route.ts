import path from 'path'
import { mkdir, writeFile } from 'fs/promises'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/auth/session'

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function uploadRoot() {
  if (process.env.UPLOAD_DIR) return process.env.UPLOAD_DIR
  return path.join(process.cwd(), '..', 'web', 'public', 'uploads')
}

async function optimizeImage(bytes: Buffer, ext: string): Promise<{ buffer: Buffer; ext: string }> {
  try {
    const sharp = (await import('sharp')).default
    const pipeline = sharp(bytes).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    if (ext === 'png') {
      return { buffer: await pipeline.png({ compressionLevel: 8 }).toBuffer(), ext: 'png' }
    }
    return { buffer: await pipeline.webp({ quality: 82 }).toBuffer(), ext: 'webp' }
  } catch {
    return { buffer: bytes, ext }
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
  const folder = String(form.get('folder') ?? 'general').replace(/[^a-z0-9-_]/gi, '')
  const optimize = form.get('optimize') === '1'

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 })
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Only JPG, PNG, WebP or GIF allowed' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Max file size is 8MB' }, { status: 400 })
  }

  let ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  let bytes = Buffer.from(await file.arrayBuffer()) as Buffer

  if (optimize && file.type !== 'image/gif') {
    const result = await optimizeImage(bytes, ext)
    bytes = Buffer.from(result.buffer)
    ext = result.ext
  }

  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const dir = path.join(uploadRoot(), folder)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, safeName), bytes)

  const url = `/uploads/${folder}/${safeName}`
  return NextResponse.json({ url, path: url })
}
