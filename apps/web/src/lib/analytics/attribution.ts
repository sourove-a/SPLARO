export interface SplaroAttribution {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  fbclid?: string
  referrer?: string
  trafficSource?: string
  landingPage?: string
  capturedAt?: string
}

const STORAGE_KEY = 'splaro_attribution'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

function inferTrafficSource(params: URLSearchParams, referrer: string): string {
  if (params.get('fbclid')) return 'facebook'
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

  if (utmSource) next.utmSource = utmSource
  if (utmMedium) next.utmMedium = utmMedium
  if (utmCampaign) next.utmCampaign = utmCampaign
  if (utmContent) next.utmContent = utmContent
  if (utmTerm) next.utmTerm = utmTerm
  if (fbclid) next.fbclid = fbclid

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
    incoming.utmSource ||
    incoming.utmMedium ||
    incoming.utmCampaign ||
    incoming.referrer

  if (!hasSignal && !getStoredAttribution()) {
    saveAttribution({
      trafficSource: 'direct',
      landingPage: window.location.pathname,
      capturedAt: new Date().toISOString(),
    })
    return getStoredAttribution()
  }

  if (!hasSignal) return getStoredAttribution()

  const merged = mergeAttribution(getStoredAttribution(), incoming)
  saveAttribution(merged)
  return merged
}
