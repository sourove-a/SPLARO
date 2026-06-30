import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import type { NextResponse } from 'next/server'
import {
  readResetTokens,
  readSessions,
  readUsers,
  writeResetTokens,
  writeSessions,
} from '@/lib/server/store'
import type { ResetToken, StoredSession, StoredUser } from '@/lib/server/store'

export const SESSION_COOKIE = 'splaro_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
const RESET_TTL_MS = 1000 * 60 * 60
const SCRYPT_KEYLEN = 64

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  const [salt, storedHash] = passwordHash.split(':')
  if (!salt || !storedHash) return false

  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
  const storedBuffer = Buffer.from(storedHash, 'hex')
  const hashBuffer = Buffer.from(hash, 'hex')

  if (storedBuffer.length !== hashBuffer.length) return false
  return timingSafeEqual(storedBuffer, hashBuffer)
}

function createId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString('hex')}`
}

export function sanitizeUser(user: StoredUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    createdAt: user.createdAt,
  }
}

export async function createSession(userId: string): Promise<StoredSession> {
  const sessions = await readSessions()
  const now = Date.now()
  const session: StoredSession = {
    id: createId('sess'),
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  }

  const activeSessions = sessions.filter(
    (entry) => new Date(entry.expiresAt).getTime() > now,
  )
  activeSessions.push(session)
  await writeSessions(activeSessions)

  return session
}

export async function validateSession(sessionId: string): Promise<StoredUser | null> {
  const sessions = await readSessions()
  const session = sessions.find((entry) => entry.id === sessionId)
  if (!session) return null

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await writeSessions(sessions.filter((entry) => entry.id !== sessionId))
    return null
  }

  const users = await readUsers()
  const user = users.find((entry) => entry.id === session.userId)
  return user ?? null
}

export async function destroySession(sessionId: string): Promise<void> {
  const sessions = await readSessions()
  await writeSessions(sessions.filter((entry) => entry.id !== sessionId))
}

export function attachSessionCookie(response: NextResponse, sessionId: string): NextResponse {
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })
  return response
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return response
}

export async function getSessionUser(): Promise<StoredUser | null> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value
  if (!sessionId) return null
  return validateSession(sessionId)
}

export async function findUserByEmail(email: string): Promise<StoredUser | undefined> {
  const users = await readUsers()
  const normalized = normalizeEmail(email)
  return users.find((user) => normalizeEmail(user.email) === normalized)
}

export async function findUserByPhone(phone: string): Promise<StoredUser | undefined> {
  const users = await readUsers()
  const normalized = normalizePhone(phone)
  return users.find((user) => normalizePhone(user.phone) === normalized)
}

export async function createResetToken(email: string): Promise<ResetToken | null> {
  const user = await findUserByEmail(email)
  if (!user) return null

  const tokens = await readResetTokens()
  const now = Date.now()
  const token: ResetToken = {
    token: randomBytes(24).toString('hex'),
    userId: user.id,
    email: user.email,
    expiresAt: new Date(now + RESET_TTL_MS).toISOString(),
  }

  const activeTokens = tokens.filter(
    (entry) => !entry.usedAt && new Date(entry.expiresAt).getTime() > now,
  )
  activeTokens.push(token)
  await writeResetTokens(activeTokens)

  return token
}

export async function consumeResetToken(
  tokenValue: string,
): Promise<{ user: StoredUser; token: ResetToken } | null> {
  const tokens = await readResetTokens()
  const token = tokens.find((entry) => entry.token === tokenValue)
  if (!token) return null
  if (token.usedAt) return null
  if (new Date(token.expiresAt).getTime() <= Date.now()) return null

  const users = await readUsers()
  const user = users.find((entry) => entry.id === token.userId)
  if (!user) return null

  const updatedTokens = tokens.map((entry) =>
    entry.token === tokenValue
      ? { ...entry, usedAt: new Date().toISOString() }
      : entry,
  )
  await writeResetTokens(updatedTokens)

  return { user, token }
}

export { normalizeEmail, normalizePhone }
