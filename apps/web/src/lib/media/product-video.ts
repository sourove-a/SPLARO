/**
 * Admin accepts "YouTube or MP4 link" for product video, but a YouTube page URL
 * cannot be played by `<video src>` — it needs the provider's iframe embed.
 * Returns an embed src for hosted players, or null for a direct media file.
 */
export function videoEmbedSrc(rawUrl: string): string | null {
  const raw = rawUrl?.trim()
  if (!raw) return null

  let url: URL
  try {
    url = new URL(raw, 'https://splaro.co')
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase()

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const id =
      url.searchParams.get('v') ||
      url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{6,})/)?.[1] ||
      ''
    return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1` : null
  }

  if (host === 'youtu.be') {
    const id = url.pathname.replace(/^\//, '').split('/')[0] ?? ''
    return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1` : null
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = url.pathname.match(/(\d{6,})/)?.[1] ?? ''
    return id ? `https://player.vimeo.com/video/${id}` : null
  }

  if (host === 'facebook.com' || host === 'fb.watch') {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(raw)}&show_text=false`
  }

  return null
}
