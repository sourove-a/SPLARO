export function resolveMetaAccessToken(): string {
  return (
    process.env['FB_CAPI_ACCESS_TOKEN']?.trim() ||
    process.env['META_MARKETING_ACCESS_TOKEN']?.trim() ||
    ''
  )
}

export function resolveMetaPixelIdFromEnv(): string {
  return (
    process.env['FB_PIXEL_ID']?.trim() ||
    process.env['NEXT_PUBLIC_FB_PIXEL_ID']?.trim() ||
    ''
  )
}

// No hardcoded fallback — an unset pixel must read as "not configured", never as connected.
export function resolveMetaPixelId(settings?: { facebookPixelId?: string | null }): string {
  return settings?.facebookPixelId?.trim() || resolveMetaPixelIdFromEnv() || ''
}

export function resolveMetaWebUrl(): string {
  return process.env['WEB_URL']?.trim() || process.env['NEXT_PUBLIC_SITE_URL']?.trim() || 'https://splaro.co'
}
