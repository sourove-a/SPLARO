import { SPLARO_DOMAINS } from '@splaro/config'

export function productStorefrontUrl(slug: string): string {
  const clean = slug.trim().replace(/^\/+/, '')
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? SPLARO_DOMAINS.site).replace(/\/+$/, '')
  return `${base}/products/${clean}`
}

export async function copyProductStorefrontUrl(slug: string): Promise<boolean> {
  if (!slug.trim()) return false
  try {
    await navigator.clipboard.writeText(productStorefrontUrl(slug))
    return true
  } catch {
    return false
  }
}
