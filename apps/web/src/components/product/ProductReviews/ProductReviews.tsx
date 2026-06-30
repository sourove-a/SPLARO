'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { BadgeCheck, ChevronDown, MessageSquareQuote, Star, ThumbsUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils/cn'
import type { ProductReview } from '@/lib/catalog/live'

const INITIAL_VISIBLE = 3
const HELPFUL_STORAGE_KEY = 'splaro-review-helpful'
const PANEL_ID = 'product-reviews-panel'

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
  const [hoverRating, setHoverRating] = useState(0)
  const [formRating, setFormRating] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [sectionOpen, setSectionOpen] = useState(false)

  const visibleReviews = useMemo(
    () => (showAll ? reviews : reviews.slice(0, INITIAL_VISIBLE)),
    [reviews, showAll],
  )
  const hasMore = reviews.length > INITIAL_VISIBLE
  const displayRating = rating > 0 ? rating : reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0
  const displayCount = reviewCount > 0 ? reviewCount : reviews.length

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

  const submitReview = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!formRating) {
      toast.error('রেটিং দিন / Please select a rating')
      return
    }
    if (body.trim().length < 10) {
      toast.error('কমপক্ষে ১০ অক্ষর লিখুন / Write at least 10 characters')
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

  return (
    <section className="pp-reviews" aria-labelledby="product-reviews-heading">
      <div className={cn('pp-reviews__drop', sectionOpen && 'pp-reviews__drop--open')}>
        <button
          type="button"
          className="pp-reviews__trigger"
          aria-expanded={sectionOpen}
          aria-controls={PANEL_ID}
          onClick={() => setSectionOpen((value) => !value)}
        >
          <div className="pp-reviews__trigger-copy">
            <span className="pp-reviews__trigger-eyebrow">গ্রাহক রিভিউ · Customer Reviews</span>
            <span id="product-reviews-heading" className="pp-reviews__trigger-title">
              Trusted by our community
            </span>
            <span className="pp-reviews__trigger-hint">
              {displayCount > 0
                ? `${displayRating.toFixed(1)} · ${displayCount} review${displayCount === 1 ? '' : 's'}`
                : 'No reviews yet — tap to share yours'}
            </span>
          </div>
          {displayCount > 0 ? (
            <div className="pp-reviews__trigger-score" aria-hidden>
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
                <p className="pp-reviews__subtitle">
                  আসল ক্রেতাদের অভিজ্ঞতা — Bangla বা English এ লিখতে পারবেন
                </p>

                {displayCount > 0 ? (
                  <div className="pp-reviews__summary">
                    <p className="pp-reviews__score">{displayRating.toFixed(1)}</p>
                    <StarRow rating={displayRating} size="lg" />
                    <p className="pp-reviews__count">
                      {displayCount} review{displayCount === 1 ? '' : 's'}
                    </p>
                  </div>
                ) : null}

                {reviews.length > 0 ? (
                  <>
                    <div className="pp-reviews__list">
                      {visibleReviews.map((review) => (
                        <article key={review.id} className="pp-reviews__card">
                          <div className="pp-reviews__card-top">
                            <StarRow rating={review.rating} size="sm" />
                            <div className="pp-reviews__meta">
                              <p className="pp-reviews__author">{review.name}</p>
                              {review.verified && (
                                <span className="pp-reviews__verified">
                                  <BadgeCheck strokeWidth={2} />
                                  Verified purchase
                                </span>
                              )}
                            </div>
                          </div>
                          {review.title && <p className="pp-reviews__card-title">{review.title}</p>}
                          <p className="pp-reviews__body">{review.text}</p>
                          {review.createdAt && (
                            <time className="pp-reviews__date" dateTime={review.createdAt}>
                              {formatReviewDate(review.createdAt)}
                            </time>
                          )}
                          {review.adminReply && (
                            <div className="pp-reviews__reply">
                              <p className="pp-reviews__reply-label">SPLARO · Official reply</p>
                              <p className="pp-reviews__reply-body">{review.adminReply}</p>
                            </div>
                          )}
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
                              ? 'ধন্যবাদ · Thanks'
                              : 'সহায়ক · Helpful'}
                            {(review.helpfulCount ?? 0) > 0 && (
                              <span className="pp-reviews__helpful-count">{review.helpfulCount}</span>
                            )}
                          </button>
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
                          : `আরো দেখুন · See more (${reviews.length - INITIAL_VISIBLE})`}
                        <ChevronDown
                          className={cn('pp-reviews__more-icon', showAll && 'pp-reviews__more-icon--open')}
                        />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="pp-reviews__empty">
                    <MessageSquareQuote strokeWidth={1.5} />
                    <p>এখনো কোনো রিভিউ নেই — প্রথম রিভিউ দিন</p>
                    <p className="pp-reviews__empty-sub">No reviews yet — be the first to share</p>
                  </div>
                )}

                <div className="pp-reviews__form-wrap">
                  <button
                    type="button"
                    className={cn('pp-reviews__form-toggle', formOpen && 'pp-reviews__form-toggle--open')}
                    onClick={() => setFormOpen((value) => !value)}
                    aria-expanded={formOpen}
                    aria-controls="product-review-form-panel"
                  >
                    <span className="pp-reviews__form-toggle-copy">
                      <span className="pp-reviews__form-toggle-title">
                        {isLoggedIn ? 'রিভিউ লিখুন · Write a review' : 'রিভিউ দিতে সাইন আপ করুন'}
                      </span>
                      <span className="pp-reviews__form-toggle-hint">
                        {isLoggedIn
                          ? 'ক্লিক করে ফর্ম খুলুন · Tap to open the form'
                          : 'অ্যাকাউন্ট লাগবে · Account required'}
                      </span>
                    </span>
                    <ChevronDown className="pp-reviews__form-toggle-icon" strokeWidth={2} aria-hidden />
                  </button>

                  <div
                    id="product-review-form-panel"
                    className={cn('pp-reviews__form-panel', formOpen && 'pp-reviews__form-panel--open')}
                  >
                    <div className="pp-reviews__form-panel-inner">
                      {isLoggedIn ? (
                        <form className="pp-reviews__form" onSubmit={submitReview}>
                          <p className="pp-reviews__form-hint">
                            {productName} — ছবি লাগবে না, শুধু আপনার অভিজ্ঞতা
                          </p>

                          <div className="pp-reviews__rating-input">
                            <span className="pp-reviews__rating-label">রেটিং / Rating</span>
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

                          <label className="pp-reviews__field">
                            <span>শিরোনাম (ঐচ্ছিক) · Title (optional)</span>
                            <input
                              type="text"
                              value={title}
                              onChange={(e) => setTitle(e.target.value)}
                              maxLength={120}
                              placeholder="Perfect fit for Eid"
                            />
                          </label>

                          <label className="pp-reviews__field">
                            <span>আপনার রিভিউ · Your review</span>
                            <textarea
                              value={body}
                              onChange={(e) => setBody(e.target.value)}
                              rows={3}
                              maxLength={1200}
                              placeholder="কাপড়ের কোয়ালিটি, ফিট, ডেলিভারি — যা ভালো লেগেছে বা উন্নতি দরকার..."
                              required
                            />
                          </label>

                          <button type="submit" className="pp-reviews__submit" disabled={submitting}>
                            {submitting ? 'জমা হচ্ছে…' : 'রিভিউ জমা দিন · Submit review'}
                          </button>
                        </form>
                      ) : (
                        <div className="pp-reviews__guest">
                          <p className="pp-reviews__guest-text">
                            রিভিউ দেখতে পারবেন, কিন্তু লিখতে হলে অ্যাকাউন্ট লাগবে।
                            <br />
                            You can read reviews as a guest — sign up to share yours.
                          </p>
                          <Link href={signupHref} className="pp-reviews__guest-cta">
                            অ্যাকাউন্ট তৈরি করুন · Create account
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  )
}
