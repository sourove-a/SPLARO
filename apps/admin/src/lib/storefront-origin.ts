import { resolvePublicSiteUrl } from '@splaro/config'

/** Storefront origin for admin preview / media / “open page” links. */
export function getStorefrontOrigin(): string {
  return resolvePublicSiteUrl()
}
