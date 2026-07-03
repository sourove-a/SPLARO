'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, ArrowRight, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

const TRENDING = [
  'Summer Edition',
  'Men',
  'Women',
  'Kids',
  'Footwear',
  'New products',
]

const QUICK_CATEGORIES = [
  { label: 'Summer Edition', href: '/c/summer-edition', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=120&h=160&q=80&fit=crop' },
  { label: 'Men', href: '/c/men', image: 'https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=120&h=160&q=80&fit=crop' },
  { label: 'Women', href: '/c/women', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=120&h=160&q=80&fit=crop' },
  { label: 'Kids', href: '/c/kids', image: 'https://images.unsplash.com/photo-1503919545889-aef636e10ad4?w=120&h=160&q=80&fit=crop' },
  { label: 'Footwear', href: '/c/footwear', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=120&h=160&q=80&fit=crop' },
]

const QUICK_LINKS = [
  { label: 'Summer Edition', href: '/c/summer-edition' },
  { label: 'Men', href: '/c/men' },
  { label: 'Women', href: '/c/women' },
  { label: 'Kids', href: '/c/kids' },
  { label: 'Footwear', href: '/c/footwear' },
]

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      setQuery('')
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (isOpen) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="search-modal-backdrop"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="search-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Search"
          >
            <div className="search-modal__shine" aria-hidden="true" />
            <div className="search-modal__sweep" aria-hidden="true" />

            <div className="container-luxury search-modal__inner">
              <div className="search-modal__top">
                <div className="search-modal__bar">
                  <div className="search-modal__bar-shine" aria-hidden="true" />
                  <Search className="search-modal__bar-icon" strokeWidth={2} />
                  <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search SPLARO products..."
                    className="search-modal__input"
                    autoComplete="off"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && query.trim()) {
                        window.location.href = `/search?q=${encodeURIComponent(query)}`
                        onClose()
                      }
                    }}
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="search-modal__clear"
                      aria-label="Clear search"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close search"
                  className="search-modal__close"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>

              <div className="search-modal__body">
                <AnimatePresence mode="wait">
                  {query ? (
                    <motion.div
                      key="results"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Link
                        href={`/search?q=${encodeURIComponent(query)}`}
                        onClick={onClose}
                        className="search-modal__result-row"
                      >
                        <Search className="h-4 w-4 text-black/45" strokeWidth={2} />
                        <span className="search-modal__result-text">
                          Search for{' '}
                          <strong>&ldquo;{query}&rdquo;</strong>
                        </span>
                        <ArrowRight strokeWidth={2} />
                      </Link>

                      <div className="mt-4">
                        <p className="search-modal__section-label">Suggestions</p>
                        <div className="search-modal__chips">
                          {TRENDING.filter((t) =>
                            t.toLowerCase().includes(query.toLowerCase()),
                          ).map((term) => (
                            <Link
                              key={term}
                              href={`/search?q=${encodeURIComponent(term)}`}
                              onClick={onClose}
                              className="search-modal__chip"
                            >
                              {term}
                              <ArrowRight strokeWidth={2.5} />
                            </Link>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="default"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="search-modal__layout"
                    >
                      <div>
                        <p className="search-modal__section-label">
                          <TrendingUp strokeWidth={2} />
                          Trending Now
                        </p>
                        <div className="search-modal__chips">
                          {TRENDING.map((term) => (
                            <Link
                              key={term}
                              href={`/search?q=${encodeURIComponent(term)}`}
                              onClick={onClose}
                              className="search-modal__chip"
                            >
                              {term}
                            </Link>
                          ))}
                        </div>

                        <p className="search-modal__section-label mt-6">Quick Links</p>
                        <div className="search-modal__links">
                          {QUICK_LINKS.map(({ label, href }) => (
                            <Link
                              key={label}
                              href={href}
                              onClick={onClose}
                              className="search-modal__link"
                            >
                              {label}
                            </Link>
                          ))}
                        </div>
                      </div>

                      <div className="search-modal__cats">
                        <p className="search-modal__section-label">Shop by Category</p>
                        <div className="search-modal__cat-grid">
                          {QUICK_CATEGORIES.map((cat) => (
                            <Link
                              key={cat.label}
                              href={cat.href}
                              onClick={onClose}
                              className="search-modal__cat"
                            >
                              <div className="search-modal__cat-frame">
                                <Image
                                  src={cat.image}
                                  alt={cat.label}
                                  fill
                                  sizes="66px"
                                  className="object-contain object-center"
                                />
                              </div>
                              <p className="search-modal__cat-label">{cat.label}</p>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
