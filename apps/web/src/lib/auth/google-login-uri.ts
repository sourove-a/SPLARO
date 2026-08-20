/** GIS `login_uri` Google Cloud must allow — never localhost on production. */
export const PRODUCTION_GOOGLE_LOGIN_URI = 'https://splaro.co/api/auth/google/callback'

/** Paste these into the live OAuth Web client (same id as NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID). */
export const GOOGLE_CLOUD_JS_ORIGINS = [
  'https://splaro.co',
  'https://www.splaro.co',
  'http://127.0.0.1:3000',
] as const

export const GOOGLE_CLOUD_REDIRECT_URIS = [
  PRODUCTION_GOOGLE_LOGIN_URI,
  'https://splaro.co',
  'https://www.splaro.co/api/auth/google/callback',
  'https://www.splaro.co',
  'http://127.0.0.1:3000/api/auth/google/callback',
  'http://127.0.0.1:3000',
] as const

function hostnameOf(origin: string): string {
  try {
    return new URL(origin).hostname.toLowerCase()
  } catch {
    return ''
  }
}

/** Production hosts always send the pinned callback so GIS cannot leak loopback. */
export function resolveGoogleLoginUri(origin: string): string {
  const host = hostnameOf(origin)
  if (host === 'splaro.co' || host === 'www.splaro.co') {
    return PRODUCTION_GOOGLE_LOGIN_URI
  }
  // Dev: same origin as middleware (localhost → 127.0.0.1). Never send "localhost".
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]' || host === '::1' || host === '[::]' || host === '::') {
    try {
      const port = new URL(origin).port || '3000'
      return `http://127.0.0.1:${port}/api/auth/google/callback`
    } catch {
      return 'http://127.0.0.1:3000/api/auth/google/callback'
    }
  }
  const base = origin.replace(/\/$/, '')
  return `${base}/api/auth/google/callback`
}
