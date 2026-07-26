import { randomUUID } from 'crypto'
import { cookies } from 'next/headers'
import type { NextResponse } from 'next/server'

export const DEVICE_ID_COOKIE = 'splaro_did'
const DEVICE_ID_MAX_AGE = 60 * 60 * 24 * 365

const DEVICE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidDeviceId(value: string | undefined | null): value is string {
  return Boolean(value && DEVICE_ID_RE.test(value))
}

/** Read existing first-party device id cookie, or mint a new UUID. */
export async function resolveDeviceId(): Promise<{ deviceId: string; isNew: boolean }> {
  const store = await cookies()
  const existing = store.get(DEVICE_ID_COOKIE)?.value
  if (isValidDeviceId(existing)) {
    return { deviceId: existing, isNew: false }
  }
  return { deviceId: randomUUID(), isNew: true }
}

export function attachDeviceIdCookie(response: NextResponse, deviceId: string): NextResponse {
  response.cookies.set(DEVICE_ID_COOKIE, deviceId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DEVICE_ID_MAX_AGE,
    priority: 'high',
  })
  return response
}
