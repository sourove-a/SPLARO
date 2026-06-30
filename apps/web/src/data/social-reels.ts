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

/** Curated reels — add `youtubeId` when SPLARO shorts are published on the channel. */
export const SOCIAL_REELS: SocialReelItem[] = [
  {
    id: 'ig-1',
    platform: 'instagram',
    title: 'Quiet luxury edit',
    poster:
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=720&h=1280&fit=crop&q=88&auto=format',
    previewSrc: 'https://assets.mixkit.co/videos/preview/mixkit-woman-posing-for-a-photo-shoot-3980-large.mp4',
    watchUrl: 'https://www.instagram.com/splaro.bd/reels/',
  },
  {
    id: 'ig-2',
    platform: 'instagram',
    title: 'Resort collection',
    poster:
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=720&h=1280&fit=crop&q=88&auto=format',
    previewSrc: 'https://assets.mixkit.co/videos/preview/mixkit-young-woman-wearing-a-yellow-jacket-3981-large.mp4',
    watchUrl: 'https://www.instagram.com/splaro.bd/reels/',
  },
  {
    id: 'ig-3',
    platform: 'instagram',
    title: 'Behind the atelier',
    poster:
      'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=720&h=1280&fit=crop&q=88&auto=format',
    previewSrc: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-sign-1232-large.mp4',
    watchUrl: 'https://www.instagram.com/splaro.bd/reels/',
  },
  {
    id: 'yt-1',
    platform: 'youtube',
    title: 'SPLARO short',
    poster:
      'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=720&h=1280&fit=crop&q=88&auto=format',
    previewSrc: 'https://assets.mixkit.co/videos/preview/mixkit-portrait-of-a-woman-in-a-pool-1253-large.mp4',
    watchUrl: 'https://www.youtube.com/@SPLARO/shorts',
  },
  {
    id: 'yt-2',
    platform: 'youtube',
    title: 'Style in motion',
    poster:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=720&h=1280&fit=crop&q=88&auto=format',
    previewSrc: 'https://assets.mixkit.co/videos/preview/mixkit-woman-running-on-the-beach-32808-large.mp4',
    watchUrl: 'https://www.youtube.com/@SPLARO/shorts',
  },
  {
    id: 'yt-3',
    platform: 'youtube',
    title: 'New season drop',
    poster:
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=720&h=1280&fit=crop&q=88&auto=format',
    previewSrc: 'https://assets.mixkit.co/videos/preview/mixkit-woman-walking-through-a-forest-1229-large.mp4',
    watchUrl: 'https://www.youtube.com/@SPLARO/shorts',
  },
  {
    id: 'fb-1',
    platform: 'facebook',
    title: 'SPLARO reel',
    poster:
      'https://images.unsplash.com/photo-1539109136882-3b03691a9bab?w=720&h=1280&fit=crop&q=88&auto=format',
    previewSrc: 'https://assets.mixkit.co/videos/preview/mixkit-woman-doing-her-makeup-in-front-of-a-mirror-4298-large.mp4',
    watchUrl: 'https://www.facebook.com/SPLARO/reels/',
  },
  {
    id: 'fb-2',
    platform: 'facebook',
    title: 'Storefront moments',
    poster:
      'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=720&h=1280&fit=crop&q=88&auto=format',
    previewSrc: 'https://assets.mixkit.co/videos/preview/mixkit-girl-wearing-a-leather-jacket-4025-large.mp4',
    watchUrl: 'https://www.facebook.com/SPLARO/reels/',
  },
  {
    id: 'fb-3',
    platform: 'facebook',
    title: 'Community spotlight',
    poster:
      'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=720&h=1280&fit=crop&q=88&auto=format',
    previewSrc: 'https://assets.mixkit.co/videos/preview/mixkit-woman-wearing-a-white-shirt-and-a-black-jacket-3982-large.mp4',
    watchUrl: 'https://www.facebook.com/SPLARO/reels/',
  },
]

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
