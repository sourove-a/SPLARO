import { getApiBaseUrl, SPLARO_DOMAINS } from '@splaro/config'

export { SPLARO_DOMAINS, getApiBaseUrl }

function parseApiErrorBody(body: string): string {
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

  get isNetworkError() {
    return this.status === 0
  }

  get isServerError() {
    return this.status >= 500
  }
}

async function readErrorMessage(res: Response): Promise<string> {
  const body = await res.text().catch(() => '')
  const message = parseApiErrorBody(body) || res.statusText || 'Request failed'
  return message
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl()
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`

  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
  })

  if (!res.ok) {
    const message = await readErrorMessage(res)
    throw new ApiError(res.status, `API ${res.status}: ${message}`)
  }

  return res.json() as Promise<T>
}
