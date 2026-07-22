export interface SplaroAttribution {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  fbclid?: string
  gclid?: string
  /** Meta `_fbp` cookie value */
  fbp?: string
  /** Meta `_fbc` cookie value */
  fbc?: string
  referrer?: string
  trafficSource?: string
  landingPage?: string
  capturedAt?: string
}

const STORAGE_KEY = 'splaro_attribution'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const FBC_MAX_AGE_SEC = 90 * 24 * 60 * 60

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  const value = match?.[1] ? decodeURIComponent(match[1]) : ''
  return value || undefined
}

function writeCookie(name: string, value: string, maxAgeSec: number): void {
  if (typeof document === 'undefined') return
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? ';Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAgeSec};SameSite=Lax${secure}`
}

/** Ensure `_fbc` exists when ads land with `fbclid` (pixel may not have set it yet). */
export function ensureMetaFbcFromFbclid(fbclid: string): string {
  const existing = readCookie('_fbc')
  if (existing?.includes(fbclid)) return existing
  const created = `fb.1.${Date.now()}.${fbclid}`
  writeCookie('_fbc', created, FBC_MAX_AGE_SEC)
  return created
}

export function readMetaBrowserIds(): { fbp?: string; fbc?: string } {
  const fbp = readCookie('_fbp')
  const fbc = readCookie('_fbc')
  return {
    ...(fbp ? { fbp } : {}),
    ...(fbc ? { fbc } : {}),
  }
}

function inferTrafficSource(params: URLSearchParams, referrer: string): string {
  if (params.get('fbclid')) return 'facebook'
  if (params.get('gclid')) return 'google'
  const utm = (params.get('utm_source') ?? '').toLowerCase()
  if (utm.includes('facebook') || utm.includes('fb') || utm.includes('meta')) return 'facebook'
  if (utm.includes('instagram') || utm.includes('ig')) return 'instagram'
  if (utm.includes('google')) return 'google'
  if (referrer.includes('facebook.com') || referrer.includes('fb.com')) return 'facebook'
  if (referrer.includes('instagram.com')) return 'instagram'
  if (referrer.includes('google.')) return 'google'
  if (referrer) return 'referral'
  return 'direct'
}

export function parseAttributionFromUrl(url: string): SplaroAttribution {
  if (typeof window === 'undefined') return {}
  const parsed = new URL(url, window.location.origin)
  const params = parsed.searchParams
  const referrer = document.referrer ?? ''

  const next: SplaroAttribution = {
    capturedAt: new Date().toISOString(),
    landingPage: `${parsed.pathname}${parsed.search}`,
    trafficSource: inferTrafficSource(params, referrer),
    ...(referrer ? { referrer: referrer.slice(0, 500) } : {}),
  }

  const utmSource = params.get('utm_source')?.trim()
  const utmMedium = params.get('utm_medium')?.trim()
  const utmCampaign = params.get('utm_campaign')?.trim()
  const utmContent = params.get('utm_content')?.trim()
  const utmTerm = params.get('utm_term')?.trim()
  const fbclid = params.get('fbclid')?.trim()
  const gclid = params.get('gclid')?.trim()

  if (utmSource) next.utmSource = utmSource
  if (utmMedium) next.utmMedium = utmMedium
  if (utmCampaign) next.utmCampaign = utmCampaign
  if (utmContent) next.utmContent = utmContent
  if (utmTerm) next.utmTerm = utmTerm
  if (fbclid) {
    next.fbclid = fbclid
    next.fbc = ensureMetaFbcFromFbclid(fbclid)
  }
  if (gclid) next.gclid = gclid

  const cookies = readMetaBrowserIds()
  if (cookies.fbp) next.fbp = cookies.fbp
  if (!next.fbc && cookies.fbc) next.fbc = cookies.fbc

  return next
}

export function mergeAttribution(existing: SplaroAttribution | null, incoming: SplaroAttribution): SplaroAttribution {
  if (!existing) return incoming
  return {
    ...existing,
    ...Object.fromEntries(
      Object.entries(incoming).filter(([, value]) => value !== undefined && value !== ''),
    ),
  }
}

export function saveAttribution(data: SplaroAttribution): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* storage blocked */
  }
}

export function getStoredAttribution(): SplaroAttribution | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SplaroAttribution
    if (!parsed.capturedAt) return parsed
    const age = Date.now() - new Date(parsed.capturedAt).getTime()
    if (age > MAX_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    // Refresh Meta cookies on read so checkout always sends latest fbp/fbc.
    const cookies = readMetaBrowserIds()
    if (cookies.fbp || cookies.fbc) {
      return {
        ...parsed,
        ...(cookies.fbp ? { fbp: cookies.fbp } : {}),
        ...(cookies.fbc ? { fbc: cookies.fbc } : {}),
      }
    }
    return parsed
  } catch {
    return null
  }
}

export function captureAttributionFromLocation(): SplaroAttribution | null {
  if (typeof window === 'undefined') return null
  const incoming = parseAttributionFromUrl(window.location.href)
  const hasSignal =
    incoming.fbclid ||
    incoming.gclid ||
    incoming.utmSource ||
    incoming.utmMedium ||
    incoming.utmCampaign ||
    incoming.referrer

  if (!hasSignal && !getStoredAttribution()) {
    const cookies = readMetaBrowserIds()
    saveAttribution({
      trafficSource: 'direct',
      landingPage: window.location.pathname,
      capturedAt: new Date().toISOString(),
      ...cookies,
    })
    return getStoredAttribution()
  }

  if (!hasSignal) {
    const existing = getStoredAttribution()
    if (existing) {
      const cookies = readMetaBrowserIds()
      if (cookies.fbp || cookies.fbc) {
        const refreshed = { ...existing, ...cookies }
        saveAttribution(refreshed)
        return refreshed
      }
    }
    return existing
  }

  const merged = mergeAttribution(getStoredAttribution(), incoming)
  saveAttribution(merged)
  return merged
}

/** Compact payload for order create / CAPI. */
export function attributionForOrder(attr: SplaroAttribution | null): {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  fbclid?: string
  gclid?: string
  fbp?: string
  fbc?: string
  referrer?: string
  trafficSource?: string
  landingPage?: string
} | undefined {
  if (!attr) return undefined
  const cookies = readMetaBrowserIds()
  const fbp = attr.fbp || cookies.fbp
  const fbc = attr.fbc || cookies.fbc
  return {
    ...(attr.utmSource ? { utmSource: attr.utmSource } : {}),
    ...(attr.utmMedium ? { utmMedium: attr.utmMedium } : {}),
    ...(attr.utmCampaign ? { utmCampaign: attr.utmCampaign } : {}),
    ...(attr.utmContent ? { utmContent: attr.utmContent } : {}),
    ...(attr.utmTerm ? { utmTerm: attr.utmTerm } : {}),
    ...(attr.fbclid ? { fbclid: attr.fbclid } : {}),
    ...(attr.gclid ? { gclid: attr.gclid } : {}),
    ...(fbp ? { fbp } : {}),
    ...(fbc ? { fbc } : {}),
    ...(attr.referrer ? { referrer: attr.referrer } : {}),
    ...(attr.trafficSource ? { trafficSource: attr.trafficSource } : {}),
    ...(attr.landingPage ? { landingPage: attr.landingPage } : {}),
  }
}
