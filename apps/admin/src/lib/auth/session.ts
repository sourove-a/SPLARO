export const ADMIN_SESSION_COOKIE = 'splaro_admin_session'
// Shorter admin session window bounds exposure from a stolen token — there is
// no server-side revocation list (stateless HMAC token), so expiry is the
// only backstop between logout and the token becoming unusable.
const SESSION_TTL_MS = 1000 * 60 * 60 * 6 // 6 hours

export interface AdminSessionPayload {
  userId: string
  email: string
  name: string
  role: string
  storeId?: string
  exp: number
}

function getSecret(): string {
  const secret = process.env['ADMIN_SESSION_SECRET'] ?? process.env['JWT_SECRET']
  if (secret) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_SESSION_SECRET (or JWT_SECRET) must be set in production')
  }
  return 'splaro-dev-admin-session-change-me'
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function encodeStringBase64Url(value: string): string {
  return encodeBase64Url(new TextEncoder().encode(value))
}

function decodeStringBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Edge + Node compatible HMAC (Web Crypto) */
async function hmacBase64Url(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return encodeBase64Url(new Uint8Array(signature))
}

export async function createAdminSessionToken(
  payload: Omit<AdminSessionPayload, 'exp'>,
): Promise<string> {
  const full: AdminSessionPayload = {
    ...payload,
    exp: Date.now() + SESSION_TTL_MS,
  }
  const body = encodeStringBase64Url(JSON.stringify(full))
  const sig = await hmacBase64Url(body, getSecret())
  return `${body}.${sig}`
}

export async function verifyAdminSessionToken(
  token: string,
): Promise<AdminSessionPayload | null> {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null

  const expected = await hmacBase64Url(body, getSecret())
  if (sig.length !== expected.length) return null

  let mismatch = 0
  for (let i = 0; i < sig.length; i++) {
    mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  if (mismatch !== 0) return null

  try {
    const payload = JSON.parse(decodeStringBase64Url(body)) as AdminSessionPayload
    if (!payload.exp || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function sessionCookieOptions(maxAgeSec = SESSION_TTL_MS / 1000) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Strict is safe here: login is a same-origin form POST, never a
    // cross-site redirect/link landing, so there's no legitimate flow that
    // needs Lax's top-level-navigation cookie allowance.
    sameSite: 'strict' as const,
    path: '/',
    maxAge: maxAgeSec,
  }
}
