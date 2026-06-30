import type { NextResponse } from 'next/server'
import { getApiBaseUrl } from '@splaro/config'
import { cookies } from 'next/headers'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

export const SESSION_COOKIE = 'splaro_session'
export const PHONE_ACCESS_COOKIE = 'splaro_phone_access'

export interface ApiAuthUser {
  id: string
  name: string
  email: string
  phone: string
  customerId?: string
  avatar?: string | null
  phoneVerified?: boolean
  loyaltyTier?: string
}

function apiUrl(path: string): string {
  const base = getApiBaseUrl()
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(SESSION_COOKIE)?.value
}

export async function getPhoneAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(PHONE_ACCESS_COOKIE)?.value
}

export function sessionHeaders(sessionToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (sessionToken) headers['x-splaro-session'] = sessionToken
  return headers
}

export async function apiAuthSignup(input: {
  name: string
  email: string
  phone: string
  password: string
}): Promise<{ sessionToken: string; user: ApiAuthUser } | null> {
  const res = await fetch(
    apiUrl(`/storefront/auth/signup?storeId=${encodeURIComponent(STORE_ID)}`),
    {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  )
  if (!res.ok) return null
  const payload = (await res.json()) as {
    sessionToken?: string
    user?: ApiAuthUser
  }
  if (!payload.sessionToken || !payload.user) return null
  return { sessionToken: payload.sessionToken, user: payload.user }
}

export async function apiAuthLogin(input: {
  email: string
  password: string
}): Promise<{ sessionToken: string; user: ApiAuthUser } | { error: string }> {
  const res = await fetch(
    apiUrl(`/storefront/auth/login?storeId=${encodeURIComponent(STORE_ID)}`),
    {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    return { error: body.message ?? 'Invalid email or password' }
  }
  const payload = (await res.json()) as {
    sessionToken?: string
    user?: ApiAuthUser
  }
  if (!payload.sessionToken || !payload.user) {
    return { error: 'Login failed' }
  }
  return { sessionToken: payload.sessionToken, user: payload.user }
}

export async function apiAuthMe(
  sessionToken: string,
): Promise<ApiAuthUser | null> {
  const res = await fetch(apiUrl('/storefront/auth/me'), {
    headers: sessionHeaders(sessionToken),
    cache: 'no-store',
  })
  if (!res.ok) return null
  const payload = (await res.json()) as { user?: ApiAuthUser }
  return payload.user ?? null
}

export async function apiAuthLogout(sessionToken: string): Promise<void> {
  await fetch(apiUrl('/storefront/auth/logout'), {
    method: 'POST',
    headers: sessionHeaders(sessionToken),
    cache: 'no-store',
  }).catch(() => undefined)
}

export async function apiSendOtp(phone: string): Promise<{
  sent: boolean
  devCode?: string
  error?: string
}> {
  const res = await fetch(
    apiUrl(`/storefront/auth/otp/send?storeId=${encodeURIComponent(STORE_ID)}`),
    {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({ phone }),
      cache: 'no-store',
    },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    return { sent: false, error: body.message ?? 'Could not send code' }
  }
  return (await res.json()) as { sent: boolean; devCode?: string }
}

export async function apiVerifyOtp(
  phone: string,
  code: string,
): Promise<{ phoneAccessToken: string; expiresAt: string } | { error: string }> {
  const res = await fetch(
    apiUrl(`/storefront/auth/otp/verify?storeId=${encodeURIComponent(STORE_ID)}`),
    {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({ phone, code }),
      cache: 'no-store',
    },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    return { error: body.message ?? 'Invalid code' }
  }
  const payload = (await res.json()) as {
    phoneAccessToken?: string
    expiresAt?: string
  }
  if (!payload.phoneAccessToken || !payload.expiresAt) {
    return { error: 'Verification failed' }
  }
  return {
    phoneAccessToken: payload.phoneAccessToken,
    expiresAt: payload.expiresAt,
  }
}

export async function apiTrackOrders(
  phone: string,
  opts?: { sessionToken?: string; phoneAccessToken?: string },
): Promise<Record<string, unknown>[] | null> {
  const headers = sessionHeaders(opts?.sessionToken)
  if (opts?.phoneAccessToken) {
    headers['x-splaro-phone-access'] = opts.phoneAccessToken
  }

  const res = await fetch(
    apiUrl(
      `/storefront/orders/track?storeId=${encodeURIComponent(STORE_ID)}&phone=${encodeURIComponent(phone)}`,
    ),
    { headers, cache: 'no-store' },
  )
  if (!res.ok) return null
  const payload = (await res.json()) as { orders?: Record<string, unknown>[] }
  return payload.orders ?? []
}

export async function apiSearchProducts(
  q: string,
  limit = 24,
): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    apiUrl(
      `/storefront/search?storeId=${encodeURIComponent(STORE_ID)}&q=${encodeURIComponent(q)}&limit=${limit}`,
    ),
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
  )
  if (!res.ok) return []
  const payload = (await res.json()) as { products?: Record<string, unknown>[] }
  return payload.products ?? []
}

export function attachSessionCookie(
  response: NextResponse,
  sessionToken: string,
): NextResponse {
  response.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
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

export function attachPhoneAccessCookie(
  response: NextResponse,
  token: string,
  expiresAt: string,
): NextResponse {
  const maxAge = Math.max(
    60,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
  )
  response.cookies.set(PHONE_ACCESS_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  })
  return response
}
