type AuthMode = 'login' | 'signup'

/** Where to send the customer after auth — preserves checkout deep-links. */
export function resolvePostAuthDestination(nextPath: string, mode: AuthMode): string {
  const safe = nextPath.startsWith('/') ? nextPath : '/account'
  if (safe === '/checkout' || safe.startsWith('/checkout?')) return safe
  if (
    mode === 'signup' &&
    (safe === '/account' || safe.startsWith('/account?'))
  ) {
    return '/account?tab=dashboard&welcome=1'
  }
  return safe
}
