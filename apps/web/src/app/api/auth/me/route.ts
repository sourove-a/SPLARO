import { NextResponse } from 'next/server'
import { apiAuthMe, getSessionToken } from '@/lib/server/api-auth'

export async function GET() {
  const sessionToken = await getSessionToken()
  if (!sessionToken) {
    // 200 — guests have no session; 401 would surface as a console error on every page.
    return NextResponse.json({ user: null })
  }

  const user = await apiAuthMe(sessionToken)
  if (!user) {
    return NextResponse.json({ user: null })
  }

  return NextResponse.json({ user })
}
