import { getApiBaseUrl, SPLARO_DOMAINS } from '@splaro/config'
import { getAdminApiToken, setAdminApiToken } from '@/lib/auth/api-token'

export { SPLARO_DOMAINS, getApiBaseUrl }

const DEFAULT_STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'
const DEFAULT_TIMEOUT_MS = 20_000
const MAX_RETRIES = 2

function parseApiErrorBody(body: string): string {
  try {
    const json = JSON.parse(body) as { message?: string | string[] }
    if (Array.isArray(json.message)) return json.message.join(', ')
    if (json.message) return json.message
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
    return error.isNetworkError || error.isServerError
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
  let tokenRefreshed = false

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(attempt * 600)
    }

    let apiToken = getAdminApiToken()

    // On first attempt with no token, try to recover from cookie before giving up
    if (!apiToken && !tokenRefreshed && typeof window !== 'undefined') {
      apiToken = await refreshTokenFromCookie()
      tokenRefreshed = true
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort('timeout'), timeoutMs)

    try {
      const res = await fetch(fullUrl, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
          ...(init.headers ?? {}),
        },
        credentials: 'include',
      })

      clearTimeout(timer)

      if (!res.ok) {
        // On 401, attempt one token refresh from cookie then retry
        if (res.status === 401 && !tokenRefreshed && typeof window !== 'undefined') {
          tokenRefreshed = true
          const fresh = await refreshTokenFromCookie()
          if (fresh) continue
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
