import { resolvePublicSiteUrl } from '@splaro/config'

export function productStorefrontUrl(slug: string): string {
  const clean = slug.trim().replace(/^\/+/, '')
  return `${resolvePublicSiteUrl()}/products/${clean}`
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
