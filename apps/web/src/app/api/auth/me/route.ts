import { NextResponse } from 'next/server'
import { apiAuthMe, getSessionToken } from '@/lib/server/api-auth'

export async function GET() {
  const sessionToken = await getSessionToken()
  if (!sessionToken) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  const user = await apiAuthMe(sessionToken)
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  return NextResponse.json({ user })
}
