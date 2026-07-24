import { getApiBaseUrl, SPLARO_DOMAINS } from '@splaro/config'
import { clearAdminApiToken, getAdminApiToken, setAdminApiToken } from '@/lib/auth/api-token'

export { SPLARO_DOMAINS, getApiBaseUrl }

const DEFAULT_STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'
/** Fail fast under nginx 503 / Nest overload — long retries look like infinite spinners. */
const DEFAULT_TIMEOUT_MS = 12_000
const MAX_RETRIES = 1

function parseApiErrorBody(body: string): string {
  try {
    const json = JSON.parse(body) as { message?: string | string[]; error?: string }
    if (Array.isArray(json.message)) return json.message.join(', ')
    if (json.message) return json.message
    if (json.error) return json.error
  } catch {
    /* plain text */
  }
  return body || 'Request failed'
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  get isAuthError() {
    return this.status === 401 || this.status === 403
  }

  get isNotFound() {
    return this.status === 404
  }

  get isServerError() {
    return this.status >= 500
  }

  get isNetworkError() {
    return this.status === 0
  }
}

export function getStoreId(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('splaro_store_id') ?? DEFAULT_STORE_ID
  }
  return DEFAULT_STORE_ID
}

/** Browser → same-origin /api/proxy; server → direct Nest API URL. */
export function buildAdminApiUrl(path: string, storeId?: string): string {
  const sid = storeId ?? getStoreId()
  const normalized = path.startsWith('/') ? path : `/${path}`
  const separator = normalized.includes('?') ? '&' : '?'
  const withStore = normalized.includes('storeId=')
    ? normalized
    : `${normalized}${separator}storeId=${encodeURIComponent(sid)}`

  if (typeof window !== 'undefined') {
    return `/api/proxy${withStore}`
  }

  const base = getApiBaseUrl()
  return path.startsWith('http') ? path : `${base}${withStore}`
}

function shouldRetry(error: unknown, attempt: number, method: string): boolean {
  if (attempt >= MAX_RETRIES) return false
  if (method !== 'GET' && method !== 'HEAD') return false
  if (error instanceof ApiError) {
    // 503/502 usually mean Nest/nginx is saturated — retrying makes every module hang longer.
    if (error.status === 502 || error.status === 503 || error.status === 504) return false
    return error.isNetworkError
  }
  return true
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

let tokenRefreshPromise: Promise<string | null> | null = null

async function refreshTokenFromCookie(): Promise<string | null> {
  if (tokenRefreshPromise) return tokenRefreshPromise
  tokenRefreshPromise = fetch('/api/auth/me', { credentials: 'include' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { apiToken?: string } | null) => {
      const t = d?.apiToken ?? null
      if (t) setAdminApiToken(t)
      return t
    })
    .catch(() => null)
    .finally(() => { tokenRefreshPromise = null })
  return tokenRefreshPromise
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { storeId?: string; timeoutMs?: number } = {},
): Promise<T> {
  const { storeId, timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options
  const fullUrl = path.startsWith('http') ? path : buildAdminApiUrl(path, storeId)
  const method = (init.method ?? 'GET').toUpperCase()

  let lastError: unknown
  let authRetried = false

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(attempt * 600)
    }

    let apiToken = getAdminApiToken()
    const useCookieOnly = authRetried && !apiToken

    // Recover session from httpOnly cookie when sessionStorage is empty
    if (!apiToken && typeof window !== 'undefined') {
      apiToken = await refreshTokenFromCookie()
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort('timeout'), timeoutMs)

    try {
      const res = await fetch(fullUrl, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(!useCookieOnly && apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
          ...(init.headers ?? {}),
        },
        credentials: 'include',
      })

      clearTimeout(timer)

      if (!res.ok) {
        // Stale sessionStorage token blocks proxy cookie auth — clear and retry
        if (res.status === 401 && !authRetried && typeof window !== 'undefined') {
          authRetried = true
          clearAdminApiToken()
          const fresh = await refreshTokenFromCookie()
          if (fresh) continue
          continue // cookie-only retry (no Authorization header)
        }
        const body = await res.text().catch(() => res.statusText)
        const message = parseApiErrorBody(body) || `API error ${res.status}`
        const err = new ApiError(res.status, message, body)
        if (!shouldRetry(err, attempt, method)) throw err
        lastError = err
        continue
      }

      return res.json() as Promise<T>
    } catch (error) {
      clearTimeout(timer)
      if (error instanceof ApiError) throw error

      const isAbort = error instanceof Error && error.name === 'AbortError'
      const msg = isAbort ? `Request timed out after ${timeoutMs}ms` : (error instanceof Error ? error.message : 'Network error')
      const networkErr = new ApiError(0, msg)

      if (!shouldRetry(networkErr, attempt, method)) throw networkErr
      lastError = networkErr
    }
  }

  throw lastError ?? new ApiError(0, 'Request failed after retries')
}
