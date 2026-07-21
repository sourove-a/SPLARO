'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from '@/lib/motion/react'
import { LiquidGlassNavButton } from '@/components/ui/LiquidGlass'
import { HorizontalScrollRail } from '@/components/ui/HorizontalScrollRail'
import { ChevronRight, ShoppingBag } from 'lucide-react'
import { formatBDT } from '@/lib/utils/currency'
import { pluralize } from '@/lib/utils/pluralize'
import { useCartStore } from '@/store/cartStore'
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import { trackAddToCart } from '@/lib/analytics/meta-pixel'
import { resolveQuickAddVariant } from '@/lib/catalog/index'
import type { StorefrontVariantRef } from '@/data/storefront'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FootwearProduct {
  id: string
  slug?: string
  name: string
  code: string
  colors: number
  price: number
  image: string | null
  sizes?: string[]
  colorsHex?: string[]
  variantRefs?: StorefrontVariantRef[]
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

const SHOE_COLORS = ['#71717a', '#6B6B6B', '#4A7FA5', '#D4617A', '#2D6A4F']

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
  const addItem = useCartStore((state) => state.addItem)
  const href = item.slug ? `/products/${item.slug}` : undefined

  const handleAddToBag = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (!item.slug) return
    const variant = resolveQuickAddVariant(
      { variantRefs: item.variantRefs ?? [] },
      item.sizes?.[0],
      item.colorsHex?.[0],
    )
    addItem({
      productId: item.id,
      quantity: 1,
      name: item.name,
      price: item.price,
      image: item.image?.trim() || PRODUCT_IMAGE_PLACEHOLDER,
      slug: item.slug,
      ...(variant?.id ? { variantId: variant.id } : {}),
      ...(variant?.size ? { size: variant.size } : item.sizes?.[0] ? { size: item.sizes[0] } : {}),
      ...(variant?.colorHex
        ? { color: variant.colorHex }
        : item.colorsHex?.[0]
          ? { color: item.colorsHex[0] }
          : {}),
    })
    const size = variant?.size ?? item.sizes?.[0]
    const color = variant?.colorHex ?? item.colorsHex?.[0]
    trackAddToCart({
      id: variant?.id ?? item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      brand: 'SPLARO',
      ...(size || color ? { variant: [size, color].filter(Boolean).join(' / ') } : {}),
    })
  }

  const canAddToBag = Boolean(item.slug)

  const card = (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className="footwear-card shrink-0 w-64"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image block */}
      <div
        className="footwear-card__media relative rounded-2xl overflow-hidden mb-3 transition-all duration-300"
        style={{
          background: 'linear-gradient(180deg,#F7F7F8 0%,#EFEFF1 58%,#E5E5E8 100%)',
          border: `1px solid ${hovered ? 'rgba(17,17,17,0.16)' : 'rgba(17,17,17,0.06)'}`,
          boxShadow: hovered
            ? '0 18px 40px -18px rgba(17,17,17,0.22)'
            : '0 1px 2px rgba(17,17,17,0.03)',
        }}
      >
        {/* Collection / brand tag — top-right (premium style) */}
        <span className="absolute top-2.5 right-2.5 z-10 select-none rounded-full border border-[#111]/10 bg-white/75 px-2.5 py-1 text-[0.5rem] font-semibold uppercase tracking-[0.16em] text-[#4A4A4A] backdrop-blur-sm">
          SPLARO
        </span>

        <div className="h-52 flex items-center justify-center">
          {item.image
            ? <Image src={item.image} alt={item.name} fill className="object-cover" />
            : <ShoePlaceholder index={index} />
          }
        </div>

        {/* Add to bag — always on touch; hover on desktop */}
        {canAddToBag ? (
        <div
          className={cn(
            'footwear-card__cta absolute bottom-3 left-3 right-3 transition-all duration-200',
            hovered && 'footwear-card__cta--hover',
          )}
        >
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-white min-h-[2.75rem]"
            style={{
              background: 'rgba(17,17,17,0.88)',
              backdropFilter: 'blur(12px)',
            }}
            onClick={handleAddToBag}
          >
            <ShoppingBag size={13} />
            Add to Bag
          </button>
        </div>
        ) : null}
      </div>

      {/* Product info */}
      <div className="px-0.5">
        <p className="font-semibold text-[#111] text-sm leading-snug">{item.name}</p>
        <div className="flex items-center justify-between mt-1">
          {href ? (
            <Link
              href={href}
              className="text-xs text-[#6B6B6B] flex items-center gap-1 hover:text-[#111] transition-colors"
            >
              {pluralize(item.colors, 'color')} <ChevronRight size={11} />
            </Link>
          ) : (
            <span className="text-xs text-[#6B6B6B]">{pluralize(item.colors, 'color')}</span>
          )}
          <span className="text-xs font-bold text-[#111]">{formatBDT(item.price)}</span>
        </div>
      </div>
    </motion.div>
  )

  return href ? (
    <Link href={href} className="block">
      {card}
    </Link>
  ) : (
    card
  )
}

// ─── Horizontal Product Row ───────────────────────────────────────────────────

function ProductRowSection({ row }: { row: ProductRow }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const syncScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 8)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    syncScroll()
    el.addEventListener('scroll', syncScroll, { passive: true })
    const observer = new ResizeObserver(syncScroll)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', syncScroll)
      observer.disconnect()
    }
  }, [syncScroll, row.products])

  function scroll(dir: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' })
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

      <HorizontalScrollRail
        className="footwear-row__rail"
        trackClassName="footwear-row__track"
        trackRef={scrollRef}
        hideArrows
        ariaLabel={row.title}
      >
        {row.products.length === 0 ? (
          <p className="px-1 text-sm text-[#6B6B6B]">
            No live footwear products in this row yet — add products in Admin.
          </p>
        ) : (
          row.products.map((p, i) => <ProductCard key={p.id} item={p} index={i} />)
        )}
      </HorizontalScrollRail>
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
              style={{ background: 'linear-gradient(135deg,#1a1a1a 0%,#2a2a2e 50%,#3f3f46 100%)' }}
            >
              {/* decorative stone / platform shapes */}
              <div className="absolute bottom-0 left-0 right-0 h-2/3 flex items-end justify-center gap-4 pb-8 select-none pointer-events-none">
                <div className="w-48 h-32 rounded-t-3xl" style={{ background: 'rgba(16,17,20,0.10)' }} />
                <div className="w-64 h-44 rounded-t-3xl" style={{ background: 'rgba(16,17,20,0.06)' }} />
                <div className="w-40 h-24 rounded-t-3xl" style={{ background: 'rgba(16,17,20,0.08)' }} />
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
                    <span className="text-sm font-medium text-[#111] group-hover:text-[#101114] transition-colors">
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
