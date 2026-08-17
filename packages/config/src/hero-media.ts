/** Detect / normalize hero media URLs: image, direct mp4, YouTube, Vimeo, Pexels. */

const YT_ID = /^[\w-]{11}$/

/** Add https:// when a known host is pasted without a scheme. */
export function canonicalizeHeroMediaUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return t
  if (t.startsWith('//')) return `https:${t}`
  if (/^[a-z]+:\/\//i.test(t) || t.startsWith('/')) return t
  if (
    /^(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com|music\.youtube\.com|youtube-nocookie\.com|vimeo\.com|player\.vimeo\.com|pexels\.com|videos\.pexels\.com)/i.test(
      t,
    )
  ) {
    return `https://${t}`
  }
  return t
}

export function parseYoutubeId(raw: string): string | null {
  const url = canonicalizeHeroMediaUrl(raw)
  if (!url) return null
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`)
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0] ?? ''
      return YT_ID.test(id) ? id : null
    }
    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const v = u.searchParams.get('v')
      if (v && YT_ID.test(v)) return v
      const parts = u.pathname.split('/').filter(Boolean)
      const kind = parts[0]
      const id = parts[1]
      if (
        (kind === 'embed' || kind === 'shorts' || kind === 'live' || kind === 'v') &&
        id &&
        YT_ID.test(id)
      ) {
        return id
      }
    }
  } catch {
    /* not a URL */
  }
  return null
}

export function parseVimeoId(raw: string): string | null {
  const url = canonicalizeHeroMediaUrl(raw)
  if (!url) return null
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`)
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()
    if (host !== 'vimeo.com' && host !== 'player.vimeo.com') return null
    const parts = u.pathname.split('/').filter(Boolean)
    const id = host === 'player.vimeo.com' && parts[0] === 'video' ? parts[1] : parts[0]
    return id && /^\d+$/.test(id) ? id : null
  } catch {
    return null
  }
}

/** Direct playable file, including Pexels video-files mp4. */
export function isDirectVideoUrl(url: string): boolean {
  const t = canonicalizeHeroMediaUrl(url)
  if (!t) return false
  if (/\.(mp4|webm|ogg|ogv|mov|m4v|m3u8)(\?|#|$)/i.test(t)) return true
  return /videos\.pexels\.com\/video-files\//i.test(t)
}

export function parsePexelsVideoId(url: string): string | null {
  const t = canonicalizeHeroMediaUrl(url)
  const files = t.match(/videos\.pexels\.com\/video-files\/(\d+)\//i)
  if (files?.[1]) return files[1]
  const page = t.match(/pexels\.com\/(?:[a-z-]+\/)?video\/[^/?#]*?(\d+)\/?(?:\?|#|$)/i)
  return page?.[1] ?? null
}

export function isHeroVideoUrl(url: string): boolean {
  const t = canonicalizeHeroMediaUrl(url)
  if (!t) return false
  return Boolean(
    isDirectVideoUrl(t) || parseYoutubeId(t) || parseVimeoId(t) || parsePexelsVideoId(t),
  )
}

export function youtubePosterUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}

/**
 * Hero embeds use the privacy-preserving host: youtube-nocookie.com does not
 * write YouTube's tracking cookies until the visitor actually plays something,
 * and autoplay behaves identically there — `mute=1` is what satisfies the
 * browser autoplay gate, not the domain. Both hosts are allowed in the CSP
 * frame-src, so switching is a one-word change if it is ever needed.
 *
 * `origin`/`widget_referrer` are only sent when the caller supplies one.
 * YouTube rejects the JS API handshake when `origin` does not match the page
 * actually embedding the iframe, and a config-derived value (NEXT_PUBLIC_SITE_URL)
 * can easily differ from it — apex vs www, a preview host, an admin preview on
 * :3001. HeroSlider passes window.location.origin, which is always correct.
 */
export function youtubeEmbedUrl(id: string, origin?: string): string {
  const resolvedOrigin = origin?.trim()
  const q = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '0',
    playsinline: '1',
    loop: '1',
    playlist: id,
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    disablekb: '1',
    fs: '0',
    cc_load_policy: '0',
    autohide: '1',
    showinfo: '0',
    enablejsapi: '1',
  })
  if (resolvedOrigin) {
    q.set('origin', resolvedOrigin)
    q.set('widget_referrer', resolvedOrigin)
  }
  return `https://www.youtube-nocookie.com/embed/${id}?${q.toString()}`
}

export function vimeoPosterUrl(id: string): string {
  return `https://vumbnail.com/${id}.jpg`
}

export function vimeoEmbedUrl(id: string): string {
  const q = new URLSearchParams({
    autoplay: '1',
    muted: '1',
    loop: '1',
    background: '1',
  })
  return `https://player.vimeo.com/video/${id}?${q.toString()}`
}

export function pexelsVideoPosterUrl(url: string): string | undefined {
  const id = parsePexelsVideoId(url)
  if (!id) return undefined
  return `https://images.pexels.com/videos/${id}/pictures/preview-0.jpg?auto=compress&cs=tinysrgb&w=1600`
}

/** Prefer HD over UHD; derive ~360p for mobile when the Pexels filename allows it. */
export function normalizeHeroVideoUrl(url: string): { video: string; videoMobile?: string } {
  const mobile = mobilePexelsFallback(url)
  const video = url.includes('uhd_2560_1440')
    ? url.replace('uhd_2560_1440', 'hd_1920_1080')
    : url
  return mobile ? { video, videoMobile: mobile } : { video }
}

function mobilePexelsFallback(url: string): string | undefined {
  if (!url.includes('videos.pexels.com')) return undefined
  const legacy = url.replace(/(uhd|hd)_\d+_\d+_(\d+fps)/, 'sd_960_540_$2')
  if (legacy !== url) return legacy
  const numeric = url.match(/video-files\/(\d+)\/(\d+)_1920_1080_(\d+fps\.mp4)/)
  if (numeric) {
    const [, folderId, assetId, rest] = numeric
    const mobileId = String(Number(assetId) - 3)
    return `https://videos.pexels.com/video-files/${folderId}/${mobileId}_640_360_${rest}`
  }
  return undefined
}

export type HeroMediaKind = 'image' | 'file-video' | 'youtube' | 'vimeo' | 'pexels-page'

export function classifyHeroMedia(url: string): {
  kind: HeroMediaKind
  youtubeId?: string
  vimeoId?: string
  poster?: string
} {
  const t = canonicalizeHeroMediaUrl(url)
  if (!t) return { kind: 'image' }
  const youtubeId = parseYoutubeId(t)
  if (youtubeId) return { kind: 'youtube', youtubeId, poster: youtubePosterUrl(youtubeId) }
  const vimeoId = parseVimeoId(t)
  if (vimeoId) return { kind: 'vimeo', vimeoId, poster: vimeoPosterUrl(vimeoId) }
  if (isDirectVideoUrl(t)) {
    const poster = pexelsVideoPosterUrl(t)
    return poster ? { kind: 'file-video', poster } : { kind: 'file-video' }
  }
  const pexelsId = parsePexelsVideoId(t)
  if (pexelsId) {
    const poster = pexelsVideoPosterUrl(t)
    return poster ? { kind: 'pexels-page', poster } : { kind: 'pexels-page' }
  }
  return { kind: 'image' }
}

/** Library / picker thumbnail. Never feed a watch URL into <img> or Next/Image. */
export function heroMediaPreviewSrc(url: string): string {
  const classified = classifyHeroMedia(url)
  if (classified.poster) return classified.poster
  return canonicalizeHeroMediaUrl(url)
}
