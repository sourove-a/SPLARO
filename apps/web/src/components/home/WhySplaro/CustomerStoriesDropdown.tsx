'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { BadgeCheck, ChevronDown, Star } from 'lucide-react'
import {
  fetchStorefrontReviews,
  type StorefrontReview,
} from '@/lib/api/storefront-reviews'
import { cn } from '@/lib/utils/cn'

const PANEL_ID = 'splaro-customer-stories-panel'

interface CustomerStoriesDropdownProps {
  enabled: boolean
  label?: string
}

function formatReviewDate(value: string) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value))
  } catch {
    return ''
  }
}

function hintText(
  connected: boolean,
  reviewCount: number,
  aggregateRating: number | null,
): string {
  if (!connected) return 'Reviews not connected yet'
  if (reviewCount === 0) return 'No verified reviews yet'
  const rating = aggregateRating != null ? aggregateRating.toFixed(1) : ''
  const countLabel = `${reviewCount} verified review${reviewCount === 1 ? '' : 's'}`
  return rating ? `${rating} · ${countLabel}` : countLabel
}

export function CustomerStoriesDropdown({ enabled, label = 'Verified Reviews' }: CustomerStoriesDropdownProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [reviews, setReviews] = useState<StorefrontReview[]>([])
  const [aggregateRating, setAggregateRating] = useState<number | null>(null)
  const [reviewCount, setReviewCount] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void fetchStorefrontReviews(10).then(({ data, connected: ok }) => {
      if (cancelled) return
      setConnected(ok)
      setReviews(data?.reviews ?? [])
      setAggregateRating(data?.aggregateRating ?? null)
      setReviewCount(data?.reviewCount ?? 0)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [enabled])

  if (!enabled) return null

  const ratingValue =
    aggregateRating != null
      ? Math.max(0, Math.min(5, Math.round(aggregateRating)))
      : 0
  const hint = loading ? 'Loading verified reviews…' : hintText(connected, reviewCount, aggregateRating)

  return (
    <div className={cn('story-stories', open && 'story-stories--open')}>
      <button
        type="button"
        className="story-stories__trigger"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen((value) => !value)}
        disabled={loading}
      >
        <div className="story-stories__trigger-copy">
          <span className="story-stories__label">{label}</span>
          <span className="story-stories__hint">
            {ratingValue > 0 ? (
              <span className="story-stories__stars" aria-hidden>
                {Array.from({ length: ratingValue }).map((_, index) => (
                  <Star key={index} className="story-stories__star" strokeWidth={2} />
                ))}
              </span>
            ) : null}
            {hint}
          </span>
        </div>
        <span className="story-stories__chevron" aria-hidden>
          <ChevronDown strokeWidth={2.2} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={PANEL_ID}
            className="story-stories__panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            {!connected ? (
              <div className="story-stories__empty">
                <p className="story-stories__empty-title">Reviews not connected yet</p>
                <p className="story-stories__empty-copy">
                  Verified customer reviews will appear here once the review service is available.
                </p>
              </div>
            ) : reviews.length === 0 ? (
              <div className="story-stories__empty">
                <p className="story-stories__empty-title">No verified reviews yet</p>
                <p className="story-stories__empty-copy">
                  Reviews will appear after real customer feedback is approved.
                </p>
              </div>
            ) : (
              <ul className="story-stories__list">
                {reviews.map((review, index) => (
                  <motion.li
                    key={review.id}
                    className="story-stories__item"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="story-stories__item-top">
                      <div className="story-stories__avatar">{review.avatar}</div>
                      <div className="story-stories__meta">
                        <p className="story-stories__name">{review.customerName}</p>
                        <p className="story-stories__location">
                          <Link href={`/products/${review.product.slug}`} className="story-stories__product-link">
                            <em>{review.product.name}</em>
                          </Link>
                          {review.verifiedPurchase ? (
                            <span className="story-stories__verified">
                              <BadgeCheck strokeWidth={2} aria-hidden />
                              Verified purchase
                            </span>
                          ) : null}
                        </p>
                      </div>
                      {review.createdAt ? (
                        <time className="story-stories__date" dateTime={review.createdAt}>
                          {formatReviewDate(review.createdAt)}
                        </time>
                      ) : null}
                    </div>
                    <div className="story-stories__item-stars" aria-hidden>
                      {Array.from({ length: review.rating }).map((_, starIndex) => (
                        <Star key={starIndex} className="story-stories__item-star" strokeWidth={2} />
                      ))}
                    </div>
                    <p className="story-stories__quote">&ldquo;{review.body}&rdquo;</p>
                  </motion.li>
                ))}
              </ul>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
