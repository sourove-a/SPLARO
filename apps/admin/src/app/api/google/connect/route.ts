import { getServerApiBaseUrl } from '@splaro/config'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE } from '@/lib/auth/session'

const CONNECT_FALLBACK = '/dashboard/google-workspace/connect'
const ADMIN_ORIGIN = (process.env.NEXT_PUBLIC_ADMIN_URL ?? process.env.ADMIN_URL ?? 'https://admin.splaro.co').replace(
  /\/$/,
  '',
)

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  if (!token) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(CONNECT_FALLBACK)}`, ADMIN_ORIGIN))
  }

  const apiBase = getServerApiBaseUrl()
  const res = await fetch(`${apiBase}/admin/google/oauth-url`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const message = body || `OAuth URL failed (${res.status})`
    return NextResponse.redirect(
      new URL(`${CONNECT_FALLBACK}?error=${encodeURIComponent(message)}`, ADMIN_ORIGIN),
    )
  }

  const data = (await res.json()) as { url?: string }
  if (!data.url?.includes('response_type=')) {
    return NextResponse.redirect(
      new URL(`${CONNECT_FALLBACK}?error=${encodeURIComponent('Invalid OAuth URL from API')}`, ADMIN_ORIGIN),
    )
  }

  return NextResponse.redirect(data.url)
}
