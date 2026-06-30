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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="z-search-overlay fixed inset-0"
            style={{ background: 'rgba(17,17,17,0.36)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal panel */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="z-search-overlay fixed left-0 right-0 top-0"
            style={{
              background: 'rgba(255,255,255,0.82)',
              backdropFilter: 'blur(32px) saturate(1.35)',
              WebkitBackdropFilter: 'blur(32px) saturate(1.35)',
              borderBottom: '1px solid rgba(255,255,255,0.72)',
              boxShadow: '0 24px 60px rgba(17,17,17,0.14)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Search"
          >
            <div className="container-luxury py-6 lg:py-8">
              {/* Search input row */}
              <div className="flex items-center gap-4 rounded-[24px] border border-white/70 bg-white/62 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                <Search className="h-5 w-5 shrink-0 text-black/45" strokeWidth={2} />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search SPLARO products..."
                  className="flex-1 bg-transparent text-xl font-black tracking-normal text-black placeholder:text-black/35 focus:outline-none lg:text-2xl"
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && query.trim()) {
                      window.location.href = `/search?q=${encodeURIComponent(query)}`
                      onClose()
                    }
                  }}
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="flex h-7 w-7 items-center justify-center text-black/50 transition-colors hover:text-black"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  aria-label="Close search"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-white/70 bg-white/70 transition-colors hover:bg-black hover:text-white"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>

              {/* Content */}
              <div className="mt-6">
                <AnimatePresence mode="wait">
                  {/* Search results hint */}
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
                        className="group flex items-center gap-3 py-3 text-black"
                      >
                        <Search className="h-4 w-4 text-black/50" strokeWidth={2} />
                        <span className="text-lg font-black">
                          Search for{' '}
                          <strong className="font-medium">&ldquo;{query}&rdquo;</strong>
                        </span>
                        <ArrowRight className="ml-auto h-4 w-4 text-black/40 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-black" />
                      </Link>

                      {/* Filtered trending */}
                      <div className="mt-4">
                        <p className="mb-3 text-xs font-black uppercase text-black/45">Suggestions</p>
                        <div className="flex flex-wrap gap-2">
                          {TRENDING.filter((t) =>
                            t.toLowerCase().includes(query.toLowerCase()),
                          ).map((term) => (
                            <Link
                              key={term}
                              href={`/search?q=${encodeURIComponent(term)}`}
                              onClick={onClose}
                              className="group inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-sm font-black text-black transition-all hover:bg-black hover:text-white"
                            >
                              {term}
                              <ArrowRight className="h-2.5 w-2.5" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    /* Default state — trending + quick categories */
                    <motion.div
                      key="default"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto]"
                    >
                      {/* Left: Trending + Popular */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <TrendingUp className="h-4 w-4 text-black/45" strokeWidth={2} />
                          <p className="text-xs font-black uppercase text-black/45">Trending Now</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {TRENDING.map((term) => (
                            <Link
                              key={term}
                              href={`/search?q=${encodeURIComponent(term)}`}
                              onClick={onClose}
                              className="group inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/68 px-4 py-2.5 text-sm font-black text-black transition-all hover:bg-black hover:text-white"
                            >
                              {term}
                            </Link>
                          ))}
                        </div>

                        {/* Quick links */}
                        <div className="mt-6">
                          <p className="mb-3 text-xs font-black uppercase text-black/45">Quick Links</p>
                          <div className="flex flex-wrap gap-x-6 gap-y-1">
                            {[
                              { label: 'Summer Edition', href: '/c/summer-edition' },
                              { label: 'Men', href: '/c/men' },
                              { label: 'Women', href: '/c/women' },
                              { label: 'Kids', href: '/c/kids' },
                              { label: 'Footwear', href: '/c/footwear' },
                            ].map(({ label, href }) => (
                              <Link
                                key={label}
                                href={href}
                                onClick={onClose}
                                className="flex items-center gap-1.5 py-1 text-sm font-bold text-black/55 transition-colors hover:text-black"
                              >
                                <span className="h-px w-3 bg-black/30" />
                                {label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right: Quick categories with images */}
                      <div className="hidden lg:block">
                        <p className="mb-4 text-xs font-black uppercase text-black/45">Shop by Category</p>
                        <div className="flex gap-3">
                          {QUICK_CATEGORIES.map((cat) => (
                            <Link
                              key={cat.label}
                              href={cat.href}
                              onClick={onClose}
                              className="group block text-center"
                            >
                              <div className="relative mb-2 h-20 w-16 overflow-hidden rounded-[16px] bg-white/70">
                                <Image
                                  src={cat.image}
                                  alt={cat.label}
                                  fill
                                  sizes="64px"
                                  className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.06]"
                                />
                              </div>
                              <p className="text-[0.64rem] font-black text-black transition-colors group-hover:opacity-60">
                                {cat.label}
                              </p>
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
