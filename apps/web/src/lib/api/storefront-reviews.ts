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

export async function fetchStorefrontReviews(limit = 10): Promise<{
  data: StorefrontReviewsResponse | null
  connected: boolean
}> {
  try {
    const response = await fetch(`/api/reviews?limit=${limit}`, { cache: 'no-store' })
    if (!response.ok) return { data: null, connected: false }
    const data = (await response.json()) as StorefrontReviewsResponse
    return { data, connected: true }
  } catch {
    return { data: null, connected: false }
  }
}
