/** Pure helpers for post-nav recovery — kept free of Next/router for unit tests. */

export const DEFAULT_NAV_FALLBACK_MS = 12_000
export const AUTH_NAV_FALLBACK_MS = 2_000

const RECOVERABLE =
  /failed to fetch|networkerror|network error|load failed|aborted|chunkloaderror|loading chunk|failed to fetch dynamically imported module|invalid response|unexpected response|rsc|application-error|digest/i

export function navigationErrorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message
  if (typeof reason === 'string') return reason
  return String(reason ?? '')
}

export function isRecoverableNavigationError(reason: unknown): boolean {
  return RECOVERABLE.test(navigationErrorMessage(reason))
}

/**
 * URL matching the destination is not enough: App Router updates the address
 * bar before the destination RSC tree paints. A hung/404 RSC would otherwise
 * cancel hard navigation and leave a blank page.
 */
export function shouldHardNavigateAfterTimeout(input: {
  settled: boolean
  urlMatches: boolean
}): boolean {
  return !input.settled
}

export function canAttemptChunkReload(count: number, maxReloads: number): boolean {
  return count < maxReloads
}

/**
 * Full-page reload is only for missing Next static chunks after a deploy.
 * Generic `Failed to fetch` (presence, GTM, promo) must not reload the storefront.
 */
export function shouldSilentFullPageReload(input: {
  message?: string
  assetUrl?: string
}): boolean {
  const url = input.assetUrl ?? ''
  if (/\/_next\/static\//.test(url)) return true
  const message = input.message ?? ''
  return /chunkloaderror|loading chunk|failed to fetch dynamically imported module/i.test(
    message,
  )
}

