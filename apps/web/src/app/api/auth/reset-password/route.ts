import { NextResponse } from 'next/server'
import { consumeResetToken, hashPassword } from '@/lib/server/auth'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'
import { readUsers, writeUsers } from '@/lib/server/store'

interface ResetPasswordBody {
  token?: string
  password?: string
}

export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'auth-reset-password'))
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: limit.retryAfter },
      { status: 429 },
    )
  }

  let body: ResetPasswordBody
  try {
    body = (await request.json()) as ResetPasswordBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const token = body.token?.trim()
  const password = body.password

  if (!token || !password) {
    return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const consumed = await consumeResetToken(token)
  if (!consumed) {
    return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
  }

  const users = await readUsers()
  const index = users.findIndex((user) => user.id === consumed.user.id)
  if (index === -1) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const existing = users[index]
  if (!existing) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  users[index] = {
    ...existing,
    passwordHash: hashPassword(password),
  }
  await writeUsers(users)

  return NextResponse.json({ success: true, message: 'Password updated' })
}
