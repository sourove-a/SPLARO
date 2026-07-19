import type { OurStoryConfig } from '@/lib/storefront/homepage-defaults'
import {
  DEFAULT_STORY_DECK_CARDS,
  mergeStoryDeckCards,
  type StoryDeckCardConfig,
} from '@/lib/storefront/story-deck-defaults'
import type { HomepageReviewsResult, StoryDeckCard } from './types'

function applyReviewCountPlaceholder(text: string, reviewCount: number): string {
  return text.replaceAll('{{reviewCount}}', String(reviewCount))
}

function resolveVoicesBody(card: StoryDeckCardConfig, reviewCount: number): string {
  const fallback = DEFAULT_STORY_DECK_CARDS.find((c) => c.id === 'reviews')!.body
  const raw = card.body?.trim() ? card.body : fallback
  if (raw.includes('{{reviewCount}}')) {
    return applyReviewCountPlaceholder(raw, reviewCount)
  }
  // Keep legacy live-count line only while Voices body is still the default copy.
  if (reviewCount > 0 && raw === fallback) {
    return `Each verified voice softens the distance between atelier and wardrobe — ${reviewCount} stories already woven into ours.`
  }
  return raw
}

export function buildStoryDeckCards(
  story: OurStoryConfig,
  reviews: HomepageReviewsResult,
): StoryDeckCard[] {
  const cards = mergeStoryDeckCards(story.storyDeckCards)

  return cards
    .filter((card) => card.enabled)
    .map((card, index) => {
      const body =
        card.id === 'reviews' ? resolveVoicesBody(card, reviews.reviewCount) : card.body

      return {
        id: card.id,
        icon: card.icon,
        indexLabel: String(index + 1).padStart(2, '0'),
        eyebrow: card.eyebrow,
        title: card.title,
        statement: card.statement,
        body,
        detail:
          card.id === 'reviews'
            ? applyReviewCountPlaceholder(card.detail, reviews.reviewCount)
            : card.detail,
        cta: card.cta,
      }
    })
}
