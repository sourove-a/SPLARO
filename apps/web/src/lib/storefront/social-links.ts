import type { StorefrontSettings } from '@/lib/storefront/settings'

export type SocialPlatformId = 'instagram' | 'youtube' | 'facebook' | 'tiktok'

export interface StorefrontSocialLink {
  id: SocialPlatformId
  label: string
  href: string
}

const SOCIAL_FALLBACKS: Record<SocialPlatformId, { label: string; href: string }> = {
  instagram: { label: 'Instagram', href: 'https://www.instagram.com/splaro.bd' },
  youtube: { label: 'YouTube', href: 'https://www.youtube.com/@SPLARO' },
  facebook: { label: 'Facebook', href: 'https://www.facebook.com/SPLARO/' },
  tiktok: { label: 'TikTok', href: 'https://www.tiktok.com/@splaro_bd' },
}

export function getStorefrontSocialLinks(
  settings: Pick<StorefrontSettings, 'social'>,
): StorefrontSocialLink[] {
  const order: SocialPlatformId[] = ['instagram', 'youtube', 'facebook', 'tiktok']

  return order.map((id) => {
    const raw = settings.social[id]?.trim()
    const fallback = SOCIAL_FALLBACKS[id]
    return {
      id,
      label: fallback.label,
      href: raw || fallback.href,
    }
  })
}
