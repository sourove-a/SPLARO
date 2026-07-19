import { ApiError } from '@/lib/api/client'
import { reconcileAuthSession } from '@/lib/api/session'
import type { AuthUser } from '@/store/authStore'
import type { ProductCardData } from '@/types/product'

export { ApiError }

const DEFAULT_TIMEOUT_MS = 15_000
const MAX_RETRIES = 2

export type AccountProfile = {
  memberSince: string | null
  loyaltyPoints: number
  loyaltyTier: string
  totalOrders: number
}

export type AccountProfileResponse = {
  profile: AccountProfile
  user: AuthUser
  address?: AccountAddress | null
}

export type AccountAddress = {
  address: string
  district: string
  thana: string
}

export type UpdateProfilePayload = {
  name?: string
  avatar?: string | null
  address?: string
  district?: string
  thana?: string
}

export type UpdateProfileResponse = {
  user?: AuthUser
  address?: AccountAddress
  error?: string
}

function parseErrorBody(body: string): string {
  try {
    const json = JSON.parse(body) as { message?: string | string[]; error?: string }
    if (Array.isArray(json.message)) return json.message.join(', ')
    if (json.message) return json.message
    if (json.error) return json.error
  } catch {
    /* plain text */
  }
  return body.trim() || 'Request failed'
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shouldRetry(error: unknown, attempt: number, method: string): boolean {
  if (attempt >= MAX_RETRIES) return false
  if (method !== 'GET' && method !== 'HEAD') return false
  if (error instanceof ApiError) {
    return error.status === 0 || error.status >= 500
  }
  return true
}

async function accountFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const url = path.startsWith('/') ? path : `/${path}`
  let lastError: unknown
  let authRetried = false

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(attempt * 500)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort('timeout'), DEFAULT_TIMEOUT_MS)

    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers ?? {}),
        },
      })

      clearTimeout(timer)

      if (!res.ok) {
        const body = await res.text().catch(() => res.statusText)
        const message = parseErrorBody(body) || res.statusText || 'Request failed'
        const err = new ApiError(res.status, message, body)

        if (res.status === 401 && !authRetried) {
          authRetried = true
          const user = await reconcileAuthSession()
          if (user) continue
          throw new ApiError(401, 'Session expired. Please sign in again.', body)
        }

        if (!shouldRetry(err, attempt, method)) throw err
        lastError = err
        continue
      }

      return res.json() as Promise<T>
    } catch (error) {
      clearTimeout(timer)
      if (error instanceof ApiError) throw error

      const isAbort = error instanceof Error && error.name === 'AbortError'
      const msg = isAbort
        ? `Request timed out after ${DEFAULT_TIMEOUT_MS}ms`
        : error instanceof Error
          ? error.message
          : 'Network error'
      const networkErr = new ApiError(0, msg)

      if (!shouldRetry(networkErr, attempt, method)) throw networkErr
      lastError = networkErr
    }
  }

  throw lastError ?? new ApiError(0, 'Request failed after retries')
}

export async function fetchAccountProfile(): Promise<AccountProfileResponse> {
  return accountFetch<AccountProfileResponse>('/api/account/profile')
}

export async function updateAccountProfile(
  payload: UpdateProfilePayload,
): Promise<UpdateProfileResponse> {
  return accountFetch<UpdateProfileResponse>('/api/account/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function sendAccountEmailVerification() {
  return accountFetch<{ success: true; message: string; expiresIn: number }>(
    '/api/auth/email-verification/send',
    { method: 'POST' },
  )
}

export async function verifyAccountEmail(code: string) {
  return accountFetch<{ success: true; user: AuthUser }>(
    '/api/auth/email-verification/verify',
    { method: 'POST', body: JSON.stringify({ code }) },
  )
}

export async function fetchWishlistProducts(ids: string[]): Promise<ProductCardData[]> {
  if (!ids.length) return []

  const query = encodeURIComponent(ids.join(','))
  const payload = await accountFetch<{ products?: ProductCardData[] }>(
    `/api/account/wishlist/products?ids=${query}`,
  )
  return payload.products ?? []
}
