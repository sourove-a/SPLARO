const AUTH_PATH_PREFIXES = ['/login', '/signup', '/forgot-password', '/reset-password']
const AUTH_GATED_RETURN_PATHS = ['/account']

const STORAGE_KEY = 'splaro-auth-return'

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function safeSameOriginPath(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.origin)
    if (parsed.origin !== window.location.origin) return null
    if (!parsed.pathname.startsWith('/')) return null
    if (isAuthPath(parsed.pathname)) return null
    if (AUTH_GATED_RETURN_PATHS.some((path) => parsed.pathname === path || parsed.pathname.startsWith(`${path}/`))) return null
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

/** Remember where the shopper was before opening sign-in / sign-up. */
export function captureAuthReturnPath(): void {
  const existing = sessionStorage.getItem(STORAGE_KEY)
  if (existing && !isAuthPath(existing)) return

  let returnPath = '/'

  const next = new URLSearchParams(window.location.search).get('next')
  if (
    next?.startsWith('/') &&
    !isAuthPath(next) &&
    !AUTH_GATED_RETURN_PATHS.some((path) => next === path || next.startsWith(`${path}/`))
  ) {
    returnPath = next
  } else if (document.referrer) {
    const fromReferrer = safeSameOriginPath(document.referrer)
    if (fromReferrer) returnPath = fromReferrer
  }

  sessionStorage.setItem(STORAGE_KEY, returnPath)
}

export function getAuthReturnPath(): string {
  const stored = sessionStorage.getItem(STORAGE_KEY)
  if (stored && stored.startsWith('/') && !isAuthPath(stored)) return stored

  const next = new URLSearchParams(window.location.search).get('next')
  if (
    next?.startsWith('/') &&
    !isAuthPath(next) &&
    !AUTH_GATED_RETURN_PATHS.some((path) => next === path || next.startsWith(`${path}/`))
  ) return next

  if (document.referrer) {
    const fromReferrer = safeSameOriginPath(document.referrer)
    if (fromReferrer) return fromReferrer
  }

  return '/'
}

export function clearAuthReturnPath(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}
