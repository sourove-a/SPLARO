'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'

import { CUSTOMER_STORIES } from '@/data/customer-stories'

const reviews = CUSTOMER_STORIES

export function Reviews() {
  const [current, setCurrent] = useState(0)
  const prev = () => setCurrent((c) => (c - 1 + reviews.length) % reviews.length)
  const next = () => setCurrent((c) => (c + 1) % reviews.length)
  const review = reviews[current]!

  return (
    <section className="rev-section" aria-labelledby="reviews-heading">
      {/* Header */}
      <div className="rev-header">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="rev-eyebrow">Customer Stories</span>
          <h2 id="reviews-heading" className="rev-title">What people say.</h2>
          <div className="rev-stars">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="rev-star" />
            ))}
            <span className="rev-rating">4.9</span>
            <span className="rev-count">· 1,200+ reviews</span>
          </div>
        </motion.div>
      </div>

      {/* Main card */}
      <div className="rev-stage">
        <AnimatePresence mode="wait">
          <motion.div
            key={review.id}
            className="rev-card"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="rev-card__sheen" aria-hidden />
            {/* Stars */}
            <div className="rev-card__stars">
              {Array.from({ length: review.rating }).map((_, i) => (
                <Star key={i} className="rev-card__star" />
              ))}
            </div>
            {/* Quote */}
            <p className="rev-card__text">
              &ldquo;{review.text}&rdquo;
            </p>
            {/* Author */}
            <div className="rev-card__author">
              <div className="rev-card__avatar">{review.avatar}</div>
              <div className="rev-card__author-info">
                <span className="rev-card__name">{review.name}</span>
                <span className="rev-card__meta">
                  {review.location} · <em>{review.product}</em>
                </span>
              </div>
              <span className="rev-card__date">{review.date}</span>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="rev-nav">
          <button
            type="button"
            onClick={prev}
            aria-label="Previous review"
            className="splaro-nav-btn splaro-nav-btn--sm splaro-nav-btn--prev"
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
          <div className="rev-nav__dots">
            {reviews.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Review ${i + 1}`}
                className={`rev-nav__dot ${i === current ? 'rev-nav__dot--active' : ''}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={next}
            aria-label="Next review"
            className="splaro-nav-btn splaro-nav-btn--sm splaro-nav-btn--next"
          >
            <ChevronRight size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Mini cards row */}
      <div className="rev-mini-row">
        {reviews.map((r, i) => (
          <motion.button
            key={r.id}
            type="button"
            className={`rev-mini ${i === current ? 'rev-mini--active' : ''}`}
            onClick={() => setCurrent(i)}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="rev-mini__avatar">{r.avatar}</div>
            <div>
              <p className="rev-mini__name">{r.name}</p>
              <p className="rev-mini__loc">{r.location}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </section>
  )
}
