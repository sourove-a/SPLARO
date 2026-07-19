import { getServerApiBaseUrl } from '@splaro/config'
import type { StorefrontReviewsResponse } from '@/lib/api/storefront-reviews'
import { isCiOrProductionBuild, fetchWithTimeout } from '@/lib/server/build-safe-fetch'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

export interface HomepageReviewsResult extends StorefrontReviewsResponse {
  connected: boolean
}

export const EMPTY_HOMEPAGE_REVIEWS: HomepageReviewsResult = {
  reviews: [],
  aggregateRating: null,
  reviewCount: 0,
  connected: false,
}

export async function getHomepageReviews(limit = 3): Promise<HomepageReviewsResult> {
  if (isCiOrProductionBuild()) return EMPTY_HOMEPAGE_REVIEWS

  const safeLimit = Math.min(6, Math.max(1, limit))
  const url = new URL(`${getServerApiBaseUrl()}/storefront/reviews`)
  url.searchParams.set('storeId', STORE_ID)
  url.searchParams.set('limit', String(safeLimit))

  const response = await fetchWithTimeout(url.toString(), {
    next: { revalidate: 60, tags: ['storefront-products'] },
    timeoutMs: 2500,
  })

  if (!response?.ok) return EMPTY_HOMEPAGE_REVIEWS

  try {
    const data = (await response.json()) as StorefrontReviewsResponse
    return {
      reviews: Array.isArray(data.reviews) ? data.reviews.slice(0, safeLimit) : [],
      aggregateRating:
        typeof data.aggregateRating === 'number' ? data.aggregateRating : null,
      reviewCount: Number.isFinite(data.reviewCount) ? data.reviewCount : 0,
      connected: true,
    }
  } catch {
    return EMPTY_HOMEPAGE_REVIEWS
  }
}
