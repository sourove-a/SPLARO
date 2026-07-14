import type { AuthUser } from '@/store/authStore'

let sessionCheckPromise: Promise<AuthUser | null> | null = null

/**
 * Verify httpOnly session cookie against the server.
 * Returns null when there is no active session.
 * Throws on network/server errors so callers can keep cached user state.
 */
export async function reconcileAuthSession(): Promise<AuthUser | null> {
  if (sessionCheckPromise) return sessionCheckPromise

  sessionCheckPromise = (async () => {
    const res = await fetch('/api/auth/me', { credentials: 'include' })
    if (res.status === 401) return null
    if (!res.ok) {
      throw new Error(`Session check failed (${res.status})`)
    }
    const payload = (await res.json()) as { user?: AuthUser | null; sessionExpired?: boolean }
    if (payload.sessionExpired) return null
    return payload.user ?? null
  })()
    .finally(() => {
      sessionCheckPromise = null
    })

  return sessionCheckPromise
}
