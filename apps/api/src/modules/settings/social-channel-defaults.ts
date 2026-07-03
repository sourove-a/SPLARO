export type SocialPlatformKey = 'instagram' | 'facebook' | 'tiktok' | 'youtube'

export const BRAND_SOCIAL_DEFAULTS: Record<SocialPlatformKey, string> = {
  instagram: 'https://www.instagram.com/splaro.bd',
  facebook: 'https://www.facebook.com/SPLARO/',
  tiktok: 'https://www.tiktok.com/@splaro_bd',
  youtube: 'https://www.youtube.com/@SPLARO',
}

export type SocialChannelStatus = 'live' | 'default' | 'empty'

export function resolveSocialUrl(
  stored: string | null | undefined,
  platform: SocialPlatformKey,
): {
  storedUrl: string | null
  url: string
  status: SocialChannelStatus
  storefrontVisible: boolean
} {
  const trimmed = stored?.trim() ?? ''
  const fallback = BRAND_SOCIAL_DEFAULTS[platform]?.trim() ?? ''
  const url = trimmed || fallback

  return {
    storedUrl: trimmed || null,
    url,
    status: trimmed ? 'live' : fallback ? 'default' : 'empty',
    storefrontVisible: Boolean(url),
  }
}

export function formatSocialHandle(platformId: string, url: string): string {
  if (!url?.trim()) return '—'

  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    const path = parsed.pathname.replace(/\/$/, '')

    if (platformId === 'instagram') {
      const handle = path.split('/').filter(Boolean)[0]
      return handle ? `@${handle}` : url
    }
    if (platformId === 'tiktok') {
      const seg = path.split('/').filter(Boolean)[0]
      return seg?.startsWith('@') ? seg : seg ? `@${seg}` : url
    }
    if (platformId === 'facebook') {
      const seg = path.split('/').filter(Boolean)[0]
      return seg ?? url
    }
    if (platformId === 'youtube') {
      const seg = path.split('/').filter(Boolean).pop()
      return seg ?? url
    }
    if (platformId === 'whatsapp') {
      return url.replace(/^https?:\/\/wa\.me\//, '+')
    }
  } catch {
    /* fall through */
  }

  return url.length > 42 ? `${url.slice(0, 39)}…` : url
}
