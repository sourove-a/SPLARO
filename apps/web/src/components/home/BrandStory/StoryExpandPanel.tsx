'use client'

import Link from 'next/link'
import {
  BadgeCheck,
  CheckCircle2,
  Gem,
  Heart,
  Leaf,
  Sparkles,
  Sprout,
  Star,
  type LucideIcon,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from '@/lib/motion/react'
import type { OurStoryConfig, StoryPillarIcon } from '@/lib/storefront/homepage-defaults'
import { visiblePillars } from '@/lib/storefront/homepage-defaults'
import type { HomepageReviewsResult, StoryDeckCardId } from './types'

const EASE = [0.16, 1, 0.3, 1] as const

const PILLAR_ICONS: Record<StoryPillarIcon, LucideIcon> = {
  sprout: Sprout,
  leaf: Leaf,
  gem: Gem,
  star: Star,
  heart: Heart,
  sparkles: Sparkles,
}

function ReviewStars({ rating }: { rating: number }) {
  const normalized = Math.min(5, Math.max(0, Math.round(rating)))
  return (
    <span className="home-story-deck__stars" aria-label={`${normalized} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          aria-hidden
          className={index < normalized ? 'is-filled' : undefined}
          strokeWidth={1.8}
        />
      ))}
    </span>
  )
}

interface StoryExpandPanelProps {
  activeId: StoryDeckCardId
  expanded: boolean
  story: OurStoryConfig
  reviews: HomepageReviewsResult
  detail?: string
}

export function StoryExpandPanel({
  activeId,
  expanded,
  story,
  reviews,
  detail,
}: StoryExpandPanelProps) {
  const reduceMotion = useReducedMotion()
  const pillars = visiblePillars(story)
  const isSpecial = activeId === 'story' || activeId === 'philosophy' || activeId === 'reviews'

  return (
    <AnimatePresence initial={false} mode="wait">
      {expanded ? (
        <motion.div
          key={activeId}
          className="home-story-deck__expand"
          initial={reduceMotion ? false : { height: 0, opacity: 0, y: 8 }}
          animate={{ height: 'auto', opacity: 1, y: 0 }}
          exit={{ height: 0, opacity: 0, y: reduceMotion ? 0 : 6 }}
          transition={{ duration: reduceMotion ? 0 : 0.36, ease: EASE }}
        >
          <div className="home-story-deck__expand-inner">
            {activeId === 'story' ? (
              <div className="home-story-deck__copy">
                <p>{story.body1}</p>
                {story.body2 ? <p>{story.body2}</p> : null}
              </div>
            ) : null}

            {activeId === 'philosophy' ? (
              <div className="home-story-deck__copy">
                {story.quote ? (
                  <blockquote className="home-story-deck__quote">
                    <p>“{story.quote}”</p>
                    {story.quoteAttribution ? (
                      <cite>{story.quoteAttribution}</cite>
                    ) : null}
                  </blockquote>
                ) : null}
                {pillars.length > 0 ? (
                  <ul className="home-story-deck__pillars">
                    {pillars.map((pillar) => {
                      const Icon = PILLAR_ICONS[pillar.icon] ?? Leaf
                      return (
                        <li key={pillar.id} className="home-story-deck__pillar">
                          <span className="home-story-deck__pillar-icon" aria-hidden>
                            <Icon strokeWidth={1.5} />
                          </span>
                          <h3>{pillar.title}</h3>
                          <p>{pillar.body}</p>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p>
                    We value timeless design, careful craftsmanship, honest materials, and
                    clothing that earns its place in everyday life.
                  </p>
                )}
              </div>
            ) : null}

            {activeId === 'reviews' ? (
              <div className="home-story-deck__copy home-story-deck__copy--reviews">
                <p>
                  A space for the people who wear SPLARO. Until the first stories arrive,
                  share your experience with us.
                </p>
                {reviews.reviewCount === 0 ? (
                  <Link href="/contact" className="home-story-deck__story-link">
                    Share your story
                  </Link>
                ) : null}

                {reviews.reviews.length ? (
                  <>
                    {reviews.reviewCount > 0 && reviews.aggregateRating !== null ? (
                      <div className="home-story-deck__rating">
                        <strong>{reviews.aggregateRating.toFixed(1)}</strong>
                        <ReviewStars rating={reviews.aggregateRating} />
                        <span>
                          {reviews.reviewCount}{' '}
                          {reviews.reviewCount === 1 ? 'review' : 'reviews'}
                        </span>
                      </div>
                    ) : null}
                    <ul className="home-story-deck__review-list">
                      {reviews.reviews.map((review) => (
                        <li key={review.id} className="home-story-deck__review-card">
                          <div className="home-story-deck__review-top">
                            <span className="home-story-deck__avatar" aria-hidden>
                              {review.avatar}
                            </span>
                            <span className="home-story-deck__review-person">
                              <strong>{review.customerName}</strong>
                              <Link href={`/products/${review.product.slug}`}>
                                {review.product.name}
                              </Link>
                            </span>
                            <ReviewStars rating={review.rating} />
                          </div>
                          <p className="home-story-deck__review-quote">“{review.body}”</p>
                          {review.verifiedPurchase ? (
                            <span className="home-story-deck__verified">
                              <BadgeCheck aria-hidden strokeWidth={1.8} />
                              Verified purchase
                            </span>
                          ) : (
                            <span className="home-story-deck__verified home-story-deck__verified--soft">
                              <CheckCircle2 aria-hidden strokeWidth={1.8} />
                              Approved review
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : !reviews.connected ? (
                  <div className="home-story-deck__reviews-empty">
                    <p className="home-story-deck__empty-title">Customer reviews unavailable</p>
                    <p>Customer reviews are temporarily unavailable.</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {!isSpecial && detail ? (
              <div className="home-story-deck__copy">
                <p>{detail}</p>
              </div>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
