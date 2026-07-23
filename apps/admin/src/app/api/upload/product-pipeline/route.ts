import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/auth/session'
import { deleteProductPipelineFiles } from '@/lib/upload/product-pipeline-cleanup'

/**
 * DELETE /api/upload/product-pipeline
 * Body: { url: string } — removes original + all size siblings for that product asset.
 */
export async function DELETE(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  const session = token ? await verifyAdminSessionToken(token) : null
  if (!session) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }

  let body: { url?: string }
  try {
    body = (await request.json()) as { url?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const url = String(body.url ?? '').trim()
  if (!url || !url.includes('/uploads/products/')) {
    return NextResponse.json({ error: 'Product upload URL required' }, { status: 400 })
  }

  const result = await deleteProductPipelineFiles(url)
  return NextResponse.json({ ok: true, ...result })
}
