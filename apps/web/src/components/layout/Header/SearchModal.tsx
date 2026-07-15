'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from '@/lib/motion/react'
import { Search, X, ArrowRight, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import type { Category, StorefrontProduct } from '@/data/storefront'
import { LuxuryDialog, LuxuryDialogContent } from '@/components/ui/radix'
import { safeClientNavigate } from '@/lib/navigation/safe-client-navigate'

const TRENDING = [
  'Summer Edition',
  'Men',
  'Women',
  'Kids',
  'Footwear',
  'New products',
]

const PLACEHOLDER = '/images/placeholder-product.svg'

const QUICK_CATEGORIES: Array<{
  label: Exclude<Category, 'All' | 'Accessories'>
  href: string
}> = [
  { label: 'Summer Edition', href: '/c/summer-edition' },
  { label: 'Men', href: '/c/men' },
  { label: 'Women', href: '/c/women' },
  { label: 'Kids', href: '/c/kids' },
  { label: 'Footwear', href: '/c/footwear' },
]

const QUICK_LINKS = QUICK_CATEGORIES.map(({ label, href }) => ({ label, href }))

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

function pickCategoryImages(products: StorefrontProduct[]) {
  const images: Record<string, string> = {}
  for (const product of products) {
    if (!product.image || images[product.category]) continue
    images[product.category] = product.image
  }
  return images
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [categoryImages, setCategoryImages] = useState<Record<string, string>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80)
    } else {
      setQuery('')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    // Cached + capped — thumbs are optional; never block typing / Enter.
    void fetch('/api/products?limit=48', { cache: 'force-cache', signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { products?: StorefrontProduct[] } | null) => {
        if (cancelled || !payload?.products?.length) return
        setCategoryImages(pickCategoryImages(payload.products))
      })
      .catch(() => {})
      .finally(() => window.clearTimeout(timeout))
    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [isOpen])

  return (
    <LuxuryDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <LuxuryDialogContent hideClose className="search-modal spl-radix-dialog--search" aria-label="Search">
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
                    safeClientNavigate(router, `/search?q=${encodeURIComponent(query.trim())}`)
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
                                  src={categoryImages[cat.label] ?? PLACEHOLDER}
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
      </LuxuryDialogContent>
    </LuxuryDialog>
  )
}
