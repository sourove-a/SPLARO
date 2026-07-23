import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/auth/session'
import { aiUpscaleStatus } from '@/lib/upload/product-ai-upscale'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  const session = token ? await verifyAdminSessionToken(token) : null
  if (!session) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }
  return NextResponse.json(aiUpscaleStatus())
}
