import { SPLARO_DOMAINS } from '@splaro/config'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.NEXT_PUBLIC_WEB_URL?.trim() ||
  SPLARO_DOMAINS.site

export function resolveAssetUrl(value?: string | null): string {
  const trimmed = value?.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  const base = SITE_URL.replace(/\/$/, '')
  return trimmed.startsWith('/') ? `${base}${trimmed}` : `${base}/${trimmed}`
}
