import { resolvePublicSiteUrl } from '@splaro/config'

/** Storefront origin for admin preview / media / “open page” links. */
export function getStorefrontOrigin(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase()
    // Production admin domain or any splaro.co subdomain -> storefront is https://splaro.co
    if (host === 'admin.splaro.co' || host.endsWith('.splaro.co')) {
      return 'https://splaro.co'
    }
    // Loopback dev hosts — match current browser hostname so cookies & ports align
    if (host === '127.0.0.1') {
      return 'http://127.0.0.1:3000'
    }
    if (host === 'localhost') {
      return 'http://localhost:3000'
    }
  }
  return resolvePublicSiteUrl()
}
