const AUTH_PATH_PREFIXES = ['/login', '/signup', '/forgot-password', '/reset-password']
const AUTH_REQUIRED_PREFIXES = ['/account', '/checkout']

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
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

function explicitNextPath(next: string | null): string | null {
  if (!next?.startsWith('/')) return null
  if (isAuthPath(next)) return null
  return next
}

function isAuthRequiredPath(pathname: string): boolean {
  return AUTH_REQUIRED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function isSafeAuthExitPath(path: string | null): path is string {
  if (!path?.startsWith('/')) return false
  const pathname = path.split(/[?#]/, 1)[0] || '/'
  return !isAuthPath(pathname) && !isAuthRequiredPath(pathname)
}

/** Remember where the shopper was before opening sign-in / sign-up. */
export function captureAuthReturnPath(): void {
  const existing = sessionStorage.getItem(STORAGE_KEY)
  if (isSafeAuthExitPath(existing)) return

  let returnPath = '/'

  if (document.referrer) {
    const fromReferrer = safeSameOriginPath(document.referrer)
    if (isSafeAuthExitPath(fromReferrer)) returnPath = fromReferrer
  }

  const next = explicitNextPath(new URLSearchParams(window.location.search).get('next'))
  if (returnPath === '/' && isSafeAuthExitPath(next)) {
    returnPath = next
  }

  sessionStorage.setItem(STORAGE_KEY, returnPath)
}

export function getAuthReturnPath(): string {
  const stored = sessionStorage.getItem(STORAGE_KEY)
  if (isSafeAuthExitPath(stored)) return stored

  if (document.referrer) {
    const fromReferrer = safeSameOriginPath(document.referrer)
    if (isSafeAuthExitPath(fromReferrer)) return fromReferrer
  }

  const next = explicitNextPath(new URLSearchParams(window.location.search).get('next'))
  if (isSafeAuthExitPath(next)) {
    return next
  }

  return '/'
}

export function clearAuthReturnPath(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}
