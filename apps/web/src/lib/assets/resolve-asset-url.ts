function uploadAssetBaseUrl(): string {
  const cdn = process.env.NEXT_PUBLIC_CDN_URL?.trim()
  if (cdn) return cdn.replace(/\/$/, '')

  const r2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim()
  if (r2) return r2.replace(/\/$/, '')

  return 'https://splaro.co'
}

/** Turn `/uploads/...` and other site-relative asset paths into absolute URLs. */
export function resolveStorefrontAssetUrl(value?: string | null): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return ''
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed
  }
  if (!trimmed.startsWith('/')) return trimmed

  if (trimmed.startsWith('/uploads/')) {
    return `${uploadAssetBaseUrl()}${trimmed}`
  }

  // Public static assets (/images, /fonts, …) — keep site-relative for Next/Image.
  return trimmed
}
