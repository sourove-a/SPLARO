import { NextResponse } from 'next/server'
import { apiAuthMe, getSessionToken } from '@/lib/server/api-auth'

export async function GET() {
  const sessionToken = await getSessionToken()
  if (!sessionToken) {
    return NextResponse.json({ user: null })
  }

  const user = await apiAuthMe(sessionToken)
  if (!user) {
    return NextResponse.json({ user: null, sessionExpired: true })
  }

  return NextResponse.json({ user })
}
