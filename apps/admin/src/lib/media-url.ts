/** Resolve upload paths so admin (:3001) and web (:3000) both display images. */
export function resolveMediaUrl(url: string): string {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/uploads/')) {
    const webOrigin = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'
    return `${webOrigin.replace(/\/$/, '')}${url}`
  }
  return url
}
