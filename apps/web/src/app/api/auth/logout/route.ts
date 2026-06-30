import { NextResponse } from 'next/server'
import { apiAuthLogout, clearSessionCookie, getSessionToken } from '@/lib/server/api-auth'

export async function POST() {
  const sessionToken = await getSessionToken()
  if (sessionToken) {
    await apiAuthLogout(sessionToken)
  }

  const response = NextResponse.json({ ok: true })
  return clearSessionCookie(response)
}
