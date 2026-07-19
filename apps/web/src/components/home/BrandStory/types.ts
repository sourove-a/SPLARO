import type { LucideIcon } from 'lucide-react'
import type { StorefrontReviewsResponse } from '@/lib/api/storefront-reviews'
import type { OurStoryConfig } from '@/lib/storefront/homepage-defaults'

export type HomepageReviewsResult = StorefrontReviewsResponse & { connected: boolean }

export type StoryDeckCardId =
  | 'story'
  | 'philosophy'
  | 'craft'
  | 'fabric'
  | 'silhouette'
  | 'presence'
  | 'reviews'
  | 'legacy'

export type StoryDeckIconName =
  | 'leaf'
  | 'gem'
  | 'people'
  | 'sparkles'
  | 'scissors'
  | 'shirt'
  | 'crown'
  | 'feather'

export interface StoryDeckCard {
  id: StoryDeckCardId
  icon: StoryDeckIconName
  indexLabel: string
  eyebrow: string
  title: string
  statement: string
  body: string
  detail: string
  cta: string
}

export interface BrandStorySectionProps {
  story: OurStoryConfig
  reviews: HomepageReviewsResult
}

export type StoryIconMap = Record<StoryDeckIconName, LucideIcon>
