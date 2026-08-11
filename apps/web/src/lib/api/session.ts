import type { AuthUser } from '@/store/authStore'

let sessionCheckPromise: Promise<AuthUser | null> | null = null
/** Bumped when a fresh session is established so in-flight /me results are dropped. */
let sessionReconcileGeneration = 0

/**
 * Call after Google/password login sets a new cookie — prevents a stale
 * in-flight `/api/auth/me` (started with no cookie) from wiping the new user.
 */
export function invalidateAuthSessionReconcile(): void {
  sessionReconcileGeneration += 1
  sessionCheckPromise = null
}

/**
 * Verify httpOnly session cookie against the server.
 * Returns null when there is no active session.
 * Throws on network/server errors so callers can keep cached user state.
 */
export async function reconcileAuthSession(): Promise<AuthUser | null> {
  if (sessionCheckPromise) return sessionCheckPromise

  const generation = sessionReconcileGeneration

  sessionCheckPromise = (async () => {
    const res = await fetch('/api/auth/me', { credentials: 'include' })
    // A newer sign-in invalidated this reconcile — caller should not apply.
    if (generation !== sessionReconcileGeneration) {
      throw new Error('Session reconcile superseded')
    }
    if (res.status === 401) return null
    if (!res.ok) {
      throw new Error(`Session check failed (${res.status})`)
    }
    const payload = (await res.json()) as { user?: AuthUser | null; sessionExpired?: boolean }
    if (generation !== sessionReconcileGeneration) {
      throw new Error('Session reconcile superseded')
    }
    if (payload.sessionExpired) return null
    return payload.user ?? null
  })().finally(() => {
    if (generation === sessionReconcileGeneration) {
      sessionCheckPromise = null
    }
  })

  return sessionCheckPromise
}
