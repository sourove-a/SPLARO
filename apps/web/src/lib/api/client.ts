import { getApiBaseUrl, SPLARO_DOMAINS } from '@splaro/config'

export { SPLARO_DOMAINS, getApiBaseUrl }

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
    throw new Error(await res.text().catch(() => res.statusText))
  }

  return res.json() as Promise<T>
}
