'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { LiquidGlassNavButton } from '@/components/ui/LiquidGlass'
import { ChevronRight, ShoppingBag } from 'lucide-react'
import { formatBDT } from '@/lib/utils/currency'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FootwearProduct {
  id: string
  name: string
  code: string
  colors: number
  price: number
  image: string | null
}

interface ProductRow {
  id: string
  title: string
  subtitle: string
  visible: boolean
  exploreHref: string
  products: FootwearProduct[]
}

interface CategoryItem {
  id: string
  label: string
  image: string
  href: string
  visible: boolean
}

export interface FootwearConfig {
  heroBanner: {
    visible: boolean
    image: string
    alt: string
    title: string
    subtitle: string
  }
  shopByCategory: {
    visible: boolean
    title: string
    categories: CategoryItem[]
  }
  productRows: ProductRow[]
}

// ─── Shoe placeholder SVGs ────────────────────────────────────────────────────

const SHOE_COLORS = ['#C8A97E', '#6B6B6B', '#4A7FA5', '#D4617A', '#2D6A4F']

function ShoePlaceholder({ color, index }: { color?: string; index: number }) {
  const c = color ?? SHOE_COLORS[index % SHOE_COLORS.length]
  return (
    <svg width="200" height="140" viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* sole */}
      <ellipse cx="100" cy="122" rx="80" ry="10" fill={c} opacity="0.25" />
      {/* upper */}
      <path
        d="M30 90 Q40 50 100 48 Q160 46 168 78 Q172 90 168 100 Q140 112 80 112 Q44 112 30 100 Z"
        fill={c}
        opacity="0.85"
      />
      {/* strap / detail */}
      <path d="M70 60 Q100 52 130 60" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
      <path d="M60 75 Q100 65 140 75" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      {/* buckle dot */}
      <circle cx="100" cy="56" r="4" fill="white" opacity="0.7" />
    </svg>
  )
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ item, index }: { item: FootwearProduct; index: number }) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className="shrink-0 w-64 cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image block */}
      <div
        className="relative rounded-2xl overflow-hidden mb-3 transition-all duration-300"
        style={{
          background: 'linear-gradient(180deg,#F7F7F8 0%,#EFEFF1 58%,#E5E5E8 100%)',
          border: `1px solid ${hovered ? 'rgba(17,17,17,0.16)' : 'rgba(17,17,17,0.06)'}`,
          boxShadow: hovered
            ? '0 18px 40px -18px rgba(17,17,17,0.22)'
            : '0 1px 2px rgba(17,17,17,0.03)',
          transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        }}
      >
        {/* Collection / brand tag — top-right (ILYN style) */}
        <span className="absolute top-2.5 right-2.5 z-10 select-none rounded-full border border-[#111]/10 bg-white/75 px-2.5 py-1 text-[0.5rem] font-semibold uppercase tracking-[0.16em] text-[#4A4A4A] backdrop-blur-sm">
          SPLARO
        </span>

        <div className="h-52 flex items-center justify-center">
          {item.image
            ? <Image src={item.image} alt={item.name} fill className="object-cover" />
            : <ShoePlaceholder index={index} />
          }
        </div>

        {/* Add to bag overlay */}
        <motion.div
          animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 8 }}
          transition={{ duration: 0.2 }}
          className="absolute bottom-3 left-3 right-3"
        >
          <button
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-white"
            style={{
              background: 'rgba(17,17,17,0.88)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <ShoppingBag size={13} />
            Add to Bag
          </button>
        </motion.div>
      </div>

      {/* Product info */}
      <div className="px-0.5">
        <p className="font-semibold text-[#111] text-sm leading-snug">{item.name}</p>
        <div className="flex items-center justify-between mt-1">
          <button
            className="text-xs text-[#6B6B6B] flex items-center gap-1 hover:text-[#111] transition-colors"
          >
            {item.colors} colors <ChevronRight size={11} />
          </button>
          <span className="text-xs font-bold text-[#111]">{formatBDT(item.price)}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Horizontal Product Row ───────────────────────────────────────────────────

function ProductRowSection({ row }: { row: ProductRow }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(true)

  const SCROLL_AMOUNT = 280

  function scroll(dir: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'left' ? -SCROLL_AMOUNT : SCROLL_AMOUNT, behavior: 'smooth' })
  }

  function onScroll() {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 8)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8)
  }

  return (
    <section className="mb-14">
      {/* Section header */}
      <div className="flex items-end justify-between mb-6 px-4 md:px-0">
        <div>
          <h2 className="text-3xl font-light text-[#111]" style={{ fontFamily: 'var(--font-cormorant,Georgia),serif' }}>
            {row.title}
          </h2>
          {row.subtitle && <p className="text-[#6B6B6B] text-sm mt-1">{row.subtitle}</p>}
        </div>
        <div className="lg-section-nav">
          <Link href={row.exploreHref} className="lg-explore-link">
            Explore All
          </Link>
          <LiquidGlassNavButton
            direction="left"
            onClick={() => scroll('left')}
            disabled={!canLeft}
          />
          <LiquidGlassNavButton
            direction="right"
            onClick={() => scroll('right')}
            disabled={!canRight}
          />
        </div>
      </div>

      {/* Scroll row */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex gap-4 overflow-x-auto pb-2 px-4 md:px-0 scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {row.products.map((p, i) => (
          <ProductCard key={p.id} item={p} index={i} />
        ))}
      </div>
    </section>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function FootwearPage({ config }: { config: FootwearConfig }) {
  const visibleCategories = config.shopByCategory.categories.filter(c => c.visible)
  const visibleRows = config.productRows.filter(r => r.visible)

  return (
    <div style={{ background: 'var(--bg-primary,#F4F5F7)' }}>

      {/* ── Hero Banner ── */}
      {config.heroBanner.visible && (
        <div className="relative w-full h-[360px] md:h-[520px] overflow-hidden">
          {config.heroBanner.image && config.heroBanner.image !== '/images/footwear/hero-banner.jpg' ? (
            <Image
              src={config.heroBanner.image}
              alt={config.heroBanner.alt}
              fill
              className="object-cover"
              priority
            />
          ) : (
            /* Placeholder gradient when no real image */
            <div className="absolute inset-0 flex items-end"
              style={{ background: 'linear-gradient(135deg,#1a1a1a 0%,#3d2b1a 50%,#6b4c2a 100%)' }}
            >
              {/* decorative stone / platform shapes */}
              <div className="absolute bottom-0 left-0 right-0 h-2/3 flex items-end justify-center gap-4 pb-8 select-none pointer-events-none">
                <div className="w-48 h-32 rounded-t-3xl" style={{ background: 'rgba(200,169,126,0.30)' }} />
                <div className="w-64 h-44 rounded-t-3xl" style={{ background: 'rgba(200,169,126,0.20)' }} />
                <div className="w-40 h-24 rounded-t-3xl" style={{ background: 'rgba(200,169,126,0.25)' }} />
              </div>
            </div>
          )}

          {/* Overlay text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4"
            style={{ background: 'rgba(17,17,17,0.22)' }}
          >
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl md:text-6xl font-light text-white mb-3"
              style={{ fontFamily: 'var(--font-cormorant,Georgia),serif', textShadow: '0 2px 20px rgba(0,0,0,0.4)' }}
            >
              {config.heroBanner.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="text-white/80 text-base md:text-lg max-w-md"
            >
              {config.heroBanner.subtitle}
            </motion.p>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">

        {/* ── Shop By Category ── */}
        {config.shopByCategory.visible && visibleCategories.length > 0 && (
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-light text-[#111] mb-8"
              style={{ fontFamily: 'var(--font-cormorant,Georgia),serif' }}
            >
              {config.shopByCategory.title}
            </h2>

            <div className="flex flex-wrap gap-8">
              {visibleCategories.map((cat, i) => (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link href={cat.href} className="flex flex-col items-center gap-3 group">
                    {/* Circle image */}
                    <div
                      className="w-32 h-32 rounded-full overflow-hidden transition-all duration-300 group-hover:shadow-xl"
                      style={{
                        background: 'linear-gradient(135deg,#e8e9ec,#d8d9dc)',
                        boxShadow: '0 4px 16px rgba(17,17,17,0.10)',
                      }}
                    >
                      {cat.image && !cat.image.startsWith('/images/footwear/cat-') ? (
                        <Image src={cat.image} alt={cat.label} width={128} height={128} className="object-cover w-full h-full" />
                      ) : (
                        /* placeholder */
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoePlaceholder index={i} />
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-medium text-[#111] group-hover:text-[#C8A97E] transition-colors">
                      {cat.label}
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── Product Rows ── */}
        {visibleRows.map(row => (
          <ProductRowSection key={row.id} row={row} />
        ))}

      </div>
    </div>
  )
}
