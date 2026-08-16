'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from '@/lib/motion/react'
import {
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsUp,
  Truck,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils/cn'
import type { ProductReview } from '@/lib/catalog/live'

const INITIAL_VISIBLE = 4
const HELPFUL_STORAGE_KEY = 'splaro-review-helpful'
const PANEL_ID = 'product-reviews-panel'

const QUICK_REVIEW_TAGS = [
  '✨ দারুণ কাপড় / Great Fabric',
  '📐 পারফেক্ট সাইজ / Perfect Fit',
  '🚚 দ্রুত ডেলিভারি / Fast Delivery',
  '🎨 ছবির মতোই সুন্দর / Loved the Color',
  '💎 প্রিমিয়াম ফিনিশিং / Premium Finish',
]

interface ProductReviewsProps {
  productId: string
  productSlug: string
  productName: string
  rating: number
  reviewCount: number
  reviews: ProductReview[]
  isLoggedIn: boolean
}

function StarRow({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={cn('pp-reviews__stars', size !== 'md' && `pp-reviews__stars--${size}`)}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn('pp-reviews__star', i < Math.round(rating) && 'pp-reviews__star--filled')}
          strokeWidth={1.5}
        />
      ))}
    </div>
  )
}

function readHelpfulVotes(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(HELPFUL_STORAGE_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveHelpfulVote(reviewId: string) {
  const votes = readHelpfulVotes()
  votes.add(reviewId)
  window.localStorage.setItem(HELPFUL_STORAGE_KEY, JSON.stringify([...votes]))
}

function formatReviewDate(value?: string) {
  if (!value) return ''
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

function getInitials(name?: string) {
  if (!name) return 'S'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]
  const second = parts[1]
  if (first && second && first[0] && second[0]) {
    return `${first[0]}${second[0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function ProductReviews({
  productId,
  productSlug,
  productName,
  rating,
  reviewCount,
  reviews: initialReviews,
  isLoggedIn,
}: ProductReviewsProps) {
  const [reviews, setReviews] = useState(initialReviews)
  const [helpfulVotes, setHelpfulVotes] = useState<Set<string>>(() => new Set())
  const [votingId, setVotingId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [selectedStarFilter, setSelectedStarFilter] = useState<number | null>(null)
  const [hoverRating, setHoverRating] = useState(0)
  const [formRating, setFormRating] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [sectionOpen, setSectionOpen] = useState(false)

  const filteredReviews = useMemo(() => {
    if (!selectedStarFilter) return reviews
    return reviews.filter((r) => r.rating === selectedStarFilter)
  }, [reviews, selectedStarFilter])

  const visibleReviews = useMemo(
    () => (showAll ? filteredReviews : filteredReviews.slice(0, INITIAL_VISIBLE)),
    [filteredReviews, showAll],
  )
  const hasMore = filteredReviews.length > INITIAL_VISIBLE

  const displayRating = rating > 0 ? rating : reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0
  const displayCount = reviewCount > 0 ? reviewCount : reviews.length

  const ratingDistribution = useMemo(() => {
    const total = reviews.length || 1
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    reviews.forEach((r) => {
      const rounded = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5
      counts[rounded] = (counts[rounded] || 0) + 1
    })
    return ([5, 4, 3, 2, 1] as const).map((stars) => ({
      stars,
      count: counts[stars],
      percentage: Math.round((counts[stars] / total) * 100),
    }))
  }, [reviews])

  const signupHref = `/signup?next=${encodeURIComponent(`/products/${productSlug}`)}`

  useEffect(() => {
    setHelpfulVotes(readHelpfulVotes())
  }, [])

  const markHelpful = async (reviewId: string) => {
    if (helpfulVotes.has(reviewId) || votingId) return
    setVotingId(reviewId)
    try {
      const res = await fetch(`/api/reviews/${reviewId}/helpful`, { method: 'POST' })
      const payload = (await res.json().catch(() => ({}))) as {
        review?: { helpfulCount?: number }
        error?: string
      }
      if (!res.ok) {
        toast.error(payload.error ?? 'Could not register vote')
        return
      }
      saveHelpfulVote(reviewId)
      setHelpfulVotes((prev) => new Set([...prev, reviewId]))
      const count = payload.review?.helpfulCount
      if (typeof count === 'number') {
        setReviews((prev) =>
          prev.map((review) =>
            review.id === reviewId ? { ...review, helpfulCount: count } : review,
          ),
        )
      }
    } catch {
      toast.error('Could not register vote')
    } finally {
      setVotingId(null)
    }
  }

  const handleAppendTag = (tagText: string) => {
    const rawTag = tagText.replace(/^[^\w\u0980-\u09FF]+/, '').split('/')[0]
    const cleanTag = (rawTag || '').trim()
    if (!cleanTag) return
    setBody((prev) => {
      const trimmed = prev.trim()
      if (!trimmed) return cleanTag
      if (trimmed.includes(cleanTag)) return prev
      return `${trimmed}, ${cleanTag}`
    })
  }

  const submitReview = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!formRating) {
      toast.error('রেটিং দিন / Please select a rating')
      return
    }
    if (body.trim().length < 8) {
      toast.error('কমপক্ষে ৮ অক্ষর লিখুন / Write at least 8 characters')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId,
          rating: formRating,
          title: title.trim() || undefined,
          body: body.trim(),
        }),
      })
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string
        review?: { message?: string }
      }
      if (!res.ok) {
        toast.error(payload.error ?? 'রিভিউ জমা হয়নি / Could not submit review')
        return
      }
      toast.success(
        payload.review?.message ??
          'রিভিউ জমা হয়েছে — অনুমোদনের পর দেখাবে / Submitted for approval',
      )
      setFormRating(0)
      setTitle('')
      setBody('')
      setFormOpen(false)
    } catch {
      toast.error('রিভিউ জমা হয়নি / Could not submit review')
    } finally {
      setSubmitting(false)
    }
  }

  const triggerEyebrow = 'গ্রাহক রিভিউ · Customer Reviews'
  const triggerTitle =
    displayCount > 0 ? 'Trusted by our community' : 'Fit, fabric & feel'
  const triggerHint =
    displayCount > 0
      ? `${displayRating.toFixed(1)} ★ (${displayCount} verified feedback)`
      : 'Bought this? Tell the next shopper how it fits'
  const triggerAriaLabel = `${triggerEyebrow}. ${triggerTitle}. ${triggerHint}`
  const formTitle = 'রিভিউ লিখুন · Write a review'
  const formHint = displayCount > 0
    ? 'ক্লিক করে ফর্ম খুলুন · Tap to write verified review'
    : 'ফিট ও ফিল এক লাইনে · A short honest note helps'

  return (
    <section className="pp-reviews" aria-labelledby="product-reviews-heading">
      <div className={cn('pp-reviews__drop', sectionOpen && 'pp-reviews__drop--open')}>
        <button
          type="button"
          className="pp-reviews__trigger"
          aria-expanded={sectionOpen}
          aria-controls={PANEL_ID}
          aria-label={triggerAriaLabel}
          onClick={() => setSectionOpen((value) => !value)}
        >
          <div className="pp-reviews__trigger-copy">
            <p className="pp-reviews__trigger-eyebrow">{triggerEyebrow}</p>
            <p id="product-reviews-heading" className="pp-reviews__trigger-title">
              {triggerTitle}
            </p>
            <p className="pp-reviews__trigger-hint">{triggerHint}</p>
          </div>
          {displayCount > 0 ? (
            <div className="pp-reviews__trigger-score" aria-hidden>
              <span className="pp-reviews__trigger-badge">{displayRating.toFixed(1)} ★</span>
              <StarRow rating={displayRating} size="sm" />
            </div>
          ) : null}
          <span className="pp-reviews__chevron" aria-hidden>
            <ChevronDown strokeWidth={2.2} />
          </span>
        </button>

        <AnimatePresence initial={false}>
          {sectionOpen ? (
            <motion.div
              id={PANEL_ID}
              className="pp-reviews__panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="pp-reviews__panel-inner">
                {/* 2026 Trust Pill Strip */}
                <div className="pp-reviews__trust-strip">
                  <div className="pp-reviews__trust-chip">
                    <ShieldCheck className="pp-reviews__trust-icon" />
                    <span>১০০% আসল প্রিমিয়াম ফেব্রিক</span>
                  </div>
                  <div className="pp-reviews__trust-chip">
                    <Sparkles className="pp-reviews__trust-icon" />
                    <span>True to Size · ৯৬% সন্তুষ্ট</span>
                  </div>
                  <div className="pp-reviews__trust-chip">
                    <Truck className="pp-reviews__trust-icon" />
                    <span>ফাস্ট স্টেডফাস্ট ডেলিভারি</span>
                  </div>
                </div>

                {/* 2026 Executive Rating Summary Breakdown */}
                {displayCount > 0 ? (
                  <div className="pp-reviews__breakdown-box">
                    <div className="pp-reviews__breakdown-left">
                      <p className="pp-reviews__score">{displayRating.toFixed(1)}</p>
                      <StarRow rating={displayRating} size="lg" />
                      <p className="pp-reviews__count">
                        {displayCount} টি ভেরিফাইড রিভিউ
                      </p>
                    </div>

                    <div className="pp-reviews__breakdown-bars">
                      {ratingDistribution.map((item) => {
                        const isFiltered = selectedStarFilter === item.stars
                        return (
                          <button
                            key={item.stars}
                            type="button"
                            onClick={() =>
                              setSelectedStarFilter((prev) => (prev === item.stars ? null : item.stars))
                            }
                            className={cn(
                              'pp-reviews__bar-row',
                              isFiltered && 'pp-reviews__bar-row--active',
                            )}
                            title={`Filter by ${item.stars} stars`}
                          >
                            <span className="pp-reviews__bar-label">{item.stars}★</span>
                            <div className="pp-reviews__bar-track">
                              <div
                                className="pp-reviews__bar-fill"
                                style={{ width: `${item.percentage}%` }}
                              />
                            </div>
                            <span className="pp-reviews__bar-pct">{item.count}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                {/* Active Filter Pill */}
                {selectedStarFilter ? (
                  <div className="pp-reviews__filter-notice">
                    <span>ফিল্টার: {selectedStarFilter}★ রিভিউ দেখানো হচ্ছে</span>
                    <button
                      type="button"
                      onClick={() => setSelectedStarFilter(null)}
                      className="pp-reviews__filter-clear"
                    >
                      সব দেখুন (Clear)
                    </button>
                  </div>
                ) : null}

                {/* Reviews Cards List */}
                {reviews.length > 0 ? (
                  <>
                    <div className="pp-reviews__list">
                      {visibleReviews.map((review) => (
                        <article key={review.id} className="pp-reviews__card">
                          <div className="pp-reviews__card-header">
                            <div className="pp-reviews__author-avatar">
                              {getInitials(review.name)}
                            </div>
                            <div className="pp-reviews__card-author-info">
                              <div className="pp-reviews__author-row">
                                <p className="pp-reviews__author">{review.name}</p>
                                {review.verified && (
                                  <span className="pp-reviews__verified">
                                    <BadgeCheck strokeWidth={2.2} />
                                    Verified Buyer
                                  </span>
                                )}
                              </div>
                              <div className="pp-reviews__card-sub">
                                <StarRow rating={review.rating} size="sm" />
                                {review.createdAt && (
                                  <time className="pp-reviews__date" dateTime={review.createdAt}>
                                    · {formatReviewDate(review.createdAt)}
                                  </time>
                                )}
                              </div>
                            </div>
                          </div>

                          {review.title && <p className="pp-reviews__card-title">{review.title}</p>}
                          <p className="pp-reviews__body">{review.text}</p>

                          {/* 2026 Luxury Brand Reply Card */}
                          {review.adminReply && (
                            <div className="pp-reviews__reply-lux">
                              <div className="pp-reviews__reply-badge">
                                <CheckCircle2 className="pp-reviews__reply-icon" />
                                <span>SPLARO · Official Concierge Response</span>
                              </div>
                              <p className="pp-reviews__reply-body">{review.adminReply}</p>
                            </div>
                          )}

                          <div className="pp-reviews__card-footer">
                            <button
                              type="button"
                              className={cn(
                                'pp-reviews__helpful',
                                helpfulVotes.has(review.id) && 'pp-reviews__helpful--voted',
                              )}
                              onClick={() => void markHelpful(review.id)}
                              disabled={helpfulVotes.has(review.id) || votingId === review.id}
                            >
                              <ThumbsUp strokeWidth={1.75} />
                              {helpfulVotes.has(review.id)
                                ? 'ধন্যবাদ · Helpful'
                                : 'সহায়ক · Helpful'}
                              {(review.helpfulCount ?? 0) > 0 && (
                                <span className="pp-reviews__helpful-count">({review.helpfulCount})</span>
                              )}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>

                    {hasMore && (
                      <button
                        type="button"
                        className="pp-reviews__more"
                        onClick={() => setShowAll((value) => !value)}
                        aria-expanded={showAll}
                      >
                        {showAll
                          ? 'কম দেখান · Show less'
                          : `আরো রিভিউ দেখুন · See more (${filteredReviews.length - INITIAL_VISIBLE})`}
                        <ChevronDown
                          className={cn('pp-reviews__more-icon', showAll && 'pp-reviews__more-icon--open')}
                        />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="pp-reviews__empty">
                    <span className="pp-reviews__empty-icon" aria-hidden>
                      <MessageSquareQuote strokeWidth={1.5} />
                    </span>
                    <div className="pp-reviews__empty-copy">
                      <p>এখনও কোনো ক্রেতার রিভিউ নেই</p>
                      <p className="pp-reviews__empty-sub">
                        পরে থাকলে ফিট, কাপড় ও ফিনিশিং নিয়ে আপনার মূল্যবান অভিজ্ঞতা লিখুন।
                      </p>
                      <p className="pp-reviews__empty-sub pp-reviews__empty-sub--en">
                        Your honest note helps the next shopper choose with confidence.
                      </p>
                    </div>
                  </div>
                )}

                {/* 2026 Write Review Interactive Section */}
                <div className="pp-reviews__form-wrap">
                  {isLoggedIn ? (
                    <>
                      <button
                        type="button"
                        className={cn('pp-reviews__form-toggle', formOpen && 'pp-reviews__form-toggle--open')}
                        onClick={() => setFormOpen((value) => !value)}
                        aria-expanded={formOpen}
                        aria-controls="product-review-form-panel"
                        aria-label={`${formTitle}. ${formHint}`}
                      >
                        <div className="pp-reviews__form-toggle-copy">
                          <p className="pp-reviews__form-toggle-title">{formTitle}</p>
                          <p className="pp-reviews__form-toggle-hint">{formHint}</p>
                        </div>
                        <ChevronDown className="pp-reviews__form-toggle-icon" strokeWidth={2} aria-hidden />
                      </button>

                      <div
                        id="product-review-form-panel"
                        className={cn('pp-reviews__form-panel', formOpen && 'pp-reviews__form-panel--open')}
                      >
                        <div className="pp-reviews__form-panel-inner">
                          <form className="pp-reviews__form" onSubmit={submitReview}>
                            <p className="pp-reviews__form-hint">
                              <strong>{productName}</strong> — আপনার বাস্তব অভিজ্ঞতা শেয়ার করুন
                            </p>

                            <div className="pp-reviews__rating-input">
                              <span className="pp-reviews__rating-label">রেটিং নির্বাচন করুন:</span>
                              <div className="pp-reviews__rating-stars">
                                {Array.from({ length: 5 }).map((_, i) => {
                                  const value = i + 1
                                  const active = value <= (hoverRating || formRating)
                                  return (
                                    <button
                                      key={value}
                                      type="button"
                                      className={cn(
                                        'pp-reviews__rating-btn',
                                        active && 'pp-reviews__rating-btn--active',
                                      )}
                                      onMouseEnter={() => setHoverRating(value)}
                                      onMouseLeave={() => setHoverRating(0)}
                                      onClick={() => setFormRating(value)}
                                      aria-label={`${value} star${value > 1 ? 's' : ''}`}
                                    >
                                      <Star strokeWidth={1.5} />
                                    </button>
                                  )
                                })}
                              </div>
                            </div>

                            {/* Quick sentiment click tags */}
                            <div className="pp-reviews__quick-tags">
                              <span className="pp-reviews__quick-tags-title">ক্লিক করে যোগ করুন:</span>
                              <div className="pp-reviews__quick-tags-list">
                                {QUICK_REVIEW_TAGS.map((tag) => (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => handleAppendTag(tag)}
                                    className="pp-reviews__tag-chip"
                                  >
                                    {tag}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <label className="pp-reviews__field">
                              <span>শিরোনাম (ঐচ্ছিক) · Title (optional)</span>
                              <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                maxLength={120}
                                placeholder="যেমন: ঈদে পরার জন্য দারুণ ফিটিং ও কোয়ালিটি"
                              />
                            </label>

                            <label className="pp-reviews__field">
                              <span>আপনার রিভিউ · Detailed Review</span>
                              <textarea
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                rows={3}
                                maxLength={1200}
                                placeholder="কাপড়ের ফিনিশিং, আরামদায়ক কিনা এবং ডেলিভারি নিয়ে আপনার অভিজ্ঞতা লিখুন..."
                                required
                              />
                            </label>

                            <button type="submit" className="pp-reviews__submit" disabled={submitting}>
                              {submitting ? 'জমা হচ্ছে…' : 'রিভিউ জমা দিন · Submit Review'}
                            </button>
                          </form>
                        </div>
                      </div>
                    </>
                  ) : (
                    <Link href={signupHref} className="pp-reviews__guest-invite">
                      <span className="pp-reviews__guest-invite-copy">
                        <strong>আপনার অভিজ্ঞতা শেয়ার করুন</strong>
                        <small>লগইন / সাইন আপ করে ভেরিফাইড রিভিউ জমা দিন</small>
                      </span>
                      <span className="pp-reviews__guest-invite-icon" aria-hidden>
                        <ArrowUpRight strokeWidth={1.8} />
                      </span>
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  )
}

