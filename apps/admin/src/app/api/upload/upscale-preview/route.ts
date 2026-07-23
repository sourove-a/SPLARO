import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/auth/session'
import {
  MIN_UPSCALE_INPUT_WIDTH,
  UPSCALE_OFFER_BELOW,
  createUpscalePreview,
  isAiUpscaleConfigured,
} from '@/lib/upload/product-ai-upscale'

export const maxDuration = 120

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 12 * 1024 * 1024

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  const session = token ? await verifyAdminSessionToken(token) : null
  if (!session) {
    return NextResponse.json({ error: 'Sign in to upscale' }, { status: 401 })
  }

  if (!isAiUpscaleConfigured()) {
    return NextResponse.json(
      { error: 'AI upscale is not configured. Add REPLICATE_API_TOKEN.' },
      { status: 503 },
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 })
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Only JPG, PNG or WebP for AI upscale' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Max image size is 12MB' }, { status: 400 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  try {
    const sharp = (await import('sharp')).default
    const meta = await sharp(bytes).metadata()
    const width = meta.width ?? 0
    if (width < MIN_UPSCALE_INPUT_WIDTH) {
      return NextResponse.json(
        {
          error: `Too small for AI upscale (min ${MIN_UPSCALE_INPUT_WIDTH}px wide).`,
        },
        { status: 400 },
      )
    }
    if (width >= UPSCALE_OFFER_BELOW) {
      return NextResponse.json(
        {
          error: `Image is already ${width}px wide — AI upscale not needed (offer below ${UPSCALE_OFFER_BELOW}px).`,
        },
        { status: 400 },
      )
    }

    const preview = await createUpscalePreview({
      bytes,
      mime: file.type,
      originalExt: MIME_EXT[file.type] ?? 'jpg',
    })

    return NextResponse.json({
      ...preview,
      sourceWidth: width,
      sourceHeight: meta.height ?? 0,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI upscale preview failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
