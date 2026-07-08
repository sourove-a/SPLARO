export type ReelPlatform = 'instagram' | 'youtube' | 'facebook'

export interface SocialProfile {
  handle: string
  href: string
  label: string
}

export interface SocialReelItem {
  id: string
  platform: ReelPlatform
  title: string
  poster: string
  /** Muted loop preview on the storefront carousel */
  previewSrc?: string
  /** YouTube video id — modal + optional inline embed */
  youtubeId?: string
  watchUrl: string
}

export const SOCIAL_PROFILES: Record<ReelPlatform, SocialProfile> = {
  instagram: {
    handle: '@splaro.bd',
    href: 'https://www.instagram.com/splaro.bd',
    label: 'Instagram',
  },
  youtube: {
    handle: '@SPLARO',
    href: 'https://www.youtube.com/@SPLARO',
    label: 'YouTube Shorts',
  },
  facebook: {
    handle: 'SPLARO',
    href: 'https://www.facebook.com/SPLARO/',
    label: 'Facebook',
  },
}

/**
 * Published SPLARO reels from admin/settings — empty until real content is configured.
 * No placeholder Unsplash/Mixkit previews.
 */
export const SOCIAL_REELS: SocialReelItem[] = []

export function reelsForPlatform(platform: ReelPlatform): SocialReelItem[] {
  return SOCIAL_REELS.filter((item) => item.platform === platform)
}

export function resolveSocialProfiles(settings: {
  social?: { instagram?: string; youtube?: string; facebook?: string }
}) {
  const ig = settings.social?.instagram?.trim()
  const yt = settings.social?.youtube?.trim()
  const fb = settings.social?.facebook?.trim()

  return {
    instagram: ig
      ? {
          handle: ig.includes('instagram.com')
            ? `@${ig.split('/').filter(Boolean).pop() ?? 'splaro.bd'}`
            : ig.startsWith('@')
              ? ig
              : `@${ig.replace(/^@/, '')}`,
          href: ig.startsWith('http') ? ig : `https://www.instagram.com/${ig.replace(/^@/, '')}`,
          label: 'Instagram',
        }
      : SOCIAL_PROFILES.instagram,
    youtube: yt
      ? {
          handle: yt.includes('youtube.com') ? '@SPLARO' : yt.startsWith('@') ? yt : `@${yt}`,
          href: yt.startsWith('http') ? yt : `https://www.youtube.com/${yt.replace(/^@/, '')}`,
          label: 'YouTube Shorts',
        }
      : SOCIAL_PROFILES.youtube,
    facebook: fb
      ? {
          handle: fb.includes('facebook.com')
            ? fb.split('/').filter(Boolean).pop() ?? 'SPLARO'
            : fb,
          href: fb.startsWith('http') ? fb : `https://www.facebook.com/${fb}`,
          label: 'Facebook',
        }
      : SOCIAL_PROFILES.facebook,
  } satisfies Record<ReelPlatform, SocialProfile>
}
