import { resolvePublicSiteUrl } from '@splaro/config'

export function resolveAssetUrl(value?: string | null): string {
  const trimmed = value?.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  const base = resolvePublicSiteUrl()
  return trimmed.startsWith('/') ? `${base}${trimmed}` : `${base}/${trimmed}`
}
