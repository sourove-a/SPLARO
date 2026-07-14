export interface StorefrontReview {
  id: string
  rating: number
  title?: string | null
  body: string
  verifiedPurchase: boolean
  helpfulCount: number
  createdAt: string
  customerName: string
  avatar: string
  product: { name: string; slug: string }
}

export interface StorefrontReviewsResponse {
  reviews: StorefrontReview[]
  aggregateRating: number | null
  reviewCount: number
}

type ReviewsResult = {
  data: StorefrontReviewsResponse | null
  connected: boolean
}

/** Dedupe concurrent/repeat callers (StrictMode, remounts) — one request per minute per limit. */
const reviewsCache = new Map<number, { at: number; promise: Promise<ReviewsResult> }>()
const REVIEWS_CACHE_MS = 60_000

export async function fetchStorefrontReviews(limit = 10): Promise<ReviewsResult> {
  const cached = reviewsCache.get(limit)
  if (cached && Date.now() - cached.at < REVIEWS_CACHE_MS) return cached.promise

  const promise = (async (): Promise<ReviewsResult> => {
    try {
      const response = await fetch(`/api/reviews?limit=${limit}`, { cache: 'no-store' })
      if (!response.ok) return { data: null, connected: false }
      const data = (await response.json()) as StorefrontReviewsResponse
      return { data, connected: true }
    } catch {
      reviewsCache.delete(limit)
      return { data: null, connected: false }
    }
  })()

  reviewsCache.set(limit, { at: Date.now(), promise })
  return promise
}
