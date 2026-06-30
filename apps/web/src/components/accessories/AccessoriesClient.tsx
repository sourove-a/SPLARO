'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Award, ChevronRight, Eye, Heart, Shield, ShoppingBag, Zap } from 'lucide-react'
import {
  LiquidGlassFilterRow,
  LiquidGlassPagination,
  LiquidGlassPill,
} from '@/components/ui/LiquidGlass'
import { ACCESSORIES_FILTER_CATEGORIES } from '@/lib/storefront/accessories-nav'
import type { CatalogProduct } from '@/lib/catalog/live'
import { formatBDT } from '@/lib/utils/currency'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { cn } from '@/lib/utils/cn'

const PAGE_SIZE = 12

const FEATURE_PILLS = [
  { icon: Shield, label: '2-Year Warranty', color: '#2D6A4F' },
  { icon: Zap, label: 'Same-Day Ship', color: '#C8A97E' },
  { icon: Award, label: 'Premium Quality', color: '#7C5CBF' },
  { icon: Eye, label: 'UV400 Protected', color: '#4A7FA5' },
]

const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  ACCESSORIES_FILTER_CATEGORIES.map((cat) => [cat.id, cat.emoji]),
)

type SortOption = 'newest' | 'price-asc' | 'price-desc'

function matchesAccessoryCategory(product: CatalogProduct, activeCat: string) {
  if (activeCat === 'all') return true
  const slug = product.categorySlug ?? ''
  return slug === activeCat || slug.startsWith(`${activeCat}-`) || slug.startsWith(activeCat)
}

function countForCategory(products: CatalogProduct[], catId: string) {
  if (catId === 'all') return products.length
  return products.filter((product) => matchesAccessoryCategory(product, catId)).length
}

function sortProducts(products: CatalogProduct[], sort: SortOption) {
  const list = [...products]
  if (sort === 'price-asc') return list.sort((a, b) => a.price - b.price)
  if (sort === 'price-desc') return list.sort((a, b) => b.price - a.price)
  return list
}

interface AccessoriesClientProps {
  products: CatalogProduct[]
  total: number
  initialCat?: string
  initialFilter?: string
}

function AccessoriesHero() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="text-center mb-12"
    >
      <LiquidGlassPill size="sm" gold className="mb-4 uppercase tracking-widest !text-[0.65rem]">
        ✦ Premium Accessories
      </LiquidGlassPill>
      <h1
        className="text-5xl md:text-6xl font-light text-[#111111] mb-4 leading-tight"
        style={{ fontFamily: 'var(--font-cormorant, Georgia), serif' }}
      >
        The Accessories
        <span className="italic text-[#C8A97E]"> Atelier</span>
      </h1>
      <p className="text-[#6B6B6B] text-base max-w-xl mx-auto">
        Handcrafted luxury accessories from curated manufacturers worldwide
      </p>
    </motion.div>
  )
}

function FeaturePills() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="flex flex-wrap justify-center gap-3 mb-10"
    >
      {FEATURE_PILLS.map(({ icon: Icon, label, color }) => (
        <LiquidGlassPill key={label} size="sm" className="lg-pill--inset pointer-events-none">
          <Icon size={14} style={{ color }} strokeWidth={2.5} />
          {label}
        </LiquidGlassPill>
      ))}
    </motion.div>
  )
}

function CategoryPlaceholder({ categorySlug }: { categorySlug?: string }) {
  const emoji =
    CATEGORY_EMOJI[
      ACCESSORIES_FILTER_CATEGORIES.find((cat) => categorySlug?.startsWith(cat.id))?.id ?? 'all'
    ] ?? '✦'

  return (
    <div className="flex h-full w-full items-center justify-center text-5xl opacity-70">
      {emoji}
    </div>
  )
}

function WishlistButton({ productId }: { productId: string }) {
  const { toggleWishlist, isInWishlist } = useWishlistStore()
  const active = isInWishlist(productId)

  return (
    <button
      type="button"
      aria-label={active ? 'Remove from wishlist' : 'Add to wishlist'}
      aria-pressed={active}
      onClick={() => toggleWishlist(productId)}
      className="pointer-events-auto absolute right-2 top-2 z-[2] flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
    >
      <Heart
        className={cn('h-3.5 w-3.5', active ? 'fill-red-500 stroke-red-500' : 'stroke-[#111]')}
        strokeWidth={1.5}
      />
    </button>
  )
}

function AddToCartButton({ product }: { product: CatalogProduct }) {
  const addToCart = useCartStore((state) => state.addItem)

  return (
    <button
      type="button"
      aria-label={`Add ${product.name} to cart`}
      onClick={() => {
        addToCart({
          productId: product.id,
          variantId: product.id,
          quantity: 1,
          name: product.name,
          price: product.price,
          image: product.image,
          slug: product.slug,
        })
      }}
      className="shop-bag-btn"
    >
      <ShoppingBag className="h-3.5 w-3.5" strokeWidth={2} />
    </button>
  )
}

function AccessoryProductCard({ product, index }: { product: CatalogProduct; index: number }) {
  const hasDiscount = Boolean(product.compareAtPrice && product.compareAtPrice > product.price)
  const colorCount = product.colorOptions?.length ?? 0

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className="group"
    >
      <div className="relative">
        <Link href={`/products/${product.slug}`} className="block text-inherit no-underline">
          <div className="relative aspect-[4/5] overflow-hidden bg-white">
            {product.image ? (
              <Image
                src={product.image}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.03]"
              />
            ) : (
              <CategoryPlaceholder {...(product.categorySlug ? { categorySlug: product.categorySlug } : {})} />
            )}
          </div>

          <div className="pt-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="line-clamp-2 text-[0.8125rem] font-semibold leading-snug text-[#111111]">
                {product.name}
              </h3>
              {product.code ? (
                <span className="shrink-0 text-[0.6875rem] text-[#6B7280]">{product.code}</span>
              ) : null}
            </div>
            {colorCount > 0 ? (
              <p className="mt-1 text-xs text-[#6B7280]">
                {colorCount} color{colorCount > 1 ? 's' : ''}
              </p>
            ) : null}
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-sm font-bold text-[#111111]">{formatBDT(product.price)}</span>
              {hasDiscount ? (
                <span className="text-xs text-[#9CA3AF] line-through">
                  {formatBDT(product.compareAtPrice)}
                </span>
              ) : null}
            </div>
          </div>
        </Link>

        <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[4/5]">
          <div className="pointer-events-auto absolute bottom-3 left-3">
            <AddToCartButton product={product} />
          </div>
          <div className="pointer-events-auto absolute right-3 top-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <WishlistButton productId={product.id} />
          </div>
        </div>
      </div>
    </motion.article>
  )
}

function SortDropdown({
  value,
  onChange,
}: {
  value: SortOption
  onChange: (value: SortOption) => void
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <span className="sr-only">Sort by</span>
      <LiquidGlassPill size="sm" className="lg-pill--inset cursor-pointer">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as SortOption)}
          className="cursor-pointer appearance-none bg-transparent text-xs font-medium text-[#111] outline-none"
        >
          <option value="newest">Newest</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
        </select>
        <ChevronRight size={14} className="rotate-90" />
      </LiquidGlassPill>
    </label>
  )
}

function EmptyState({
  category,
  onReset,
}: {
  category: string
  onReset: () => void
}) {
  const label =
    ACCESSORIES_FILTER_CATEGORIES.find((item) => item.id === category)?.label ?? category

  return (
    <div className="py-20 text-center">
      <div className="lg-glass-card mb-6 inline-flex flex-col items-center rounded-2xl p-8">
        <span className="mb-3 text-4xl">{CATEGORY_EMOJI[category] ?? '✦'}</span>
        <h3
          className="text-xl font-light text-[#111111]"
          style={{ fontFamily: 'var(--font-cormorant, Georgia), serif' }}
        >
          Coming soon
        </h3>
        <p className="mt-1 text-sm text-[#6B6B6B]">
          No {label.toLowerCase()} products yet — check back soon.
        </p>
        {category !== 'all' ? (
          <LiquidGlassPill size="sm" className="mt-4" onClick={onReset}>
            View all accessories
          </LiquidGlassPill>
        ) : null}
      </div>
    </div>
  )
}

function BespokeCTA() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative mt-20 overflow-hidden rounded-3xl p-10 text-center lg-glass-card"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-48 w-96 -translate-x-1/2 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #C8A97E 0%, transparent 70%)', filter: 'blur(40px)' }}
      />
      <h2
        className="relative mb-3 text-4xl font-light text-[#111111]"
        style={{ fontFamily: 'var(--font-cormorant, Georgia), serif' }}
      >
        Bespoke Manufacturing
      </h2>
      <p className="relative mx-auto mb-8 max-w-md text-[#6B6B6B]">
        Custom orders, OEM production, and private label accessories — crafted to your exact specifications.
      </p>
      <div className="relative flex flex-wrap justify-center gap-3">
        <LiquidGlassPill size="lg" active className="!px-8 !py-3">
          Start Custom Order
        </LiquidGlassPill>
        <LiquidGlassPill size="lg" className="!px-8 !py-3">
          View Catalog
        </LiquidGlassPill>
      </div>
    </motion.div>
  )
}

export function AccessoriesClient({
  products,
  total,
  initialCat = 'all',
  initialFilter,
}: AccessoriesClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeCat, setActiveCat] = useState(initialCat)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortOption>('newest')

  useEffect(() => {
    setActiveCat(initialCat)
    setPage(1)
  }, [initialCat])

  const filterItems = useMemo(
    () =>
      ACCESSORIES_FILTER_CATEGORIES.map((cat) => {
        const count = countForCategory(products, cat.id)
        return {
          id: cat.id,
          label: count > 0 && cat.id !== 'all' ? `${cat.label} (${count})` : cat.label,
          emoji: cat.emoji,
        }
      }),
    [products],
  )

  const filtered = useMemo(() => {
    let list =
      activeCat === 'all'
        ? products
        : products.filter((product) => matchesAccessoryCategory(product, activeCat))

    if (initialFilter === 'new') {
      list = list.filter((product) => product.isNewArrival)
    } else if (initialFilter === 'bestsellers') {
      list = list.filter((product) => product.isBestSeller)
    }

    return sortProducts(list, sort)
  }, [activeCat, products, sort, initialFilter])

  const handleCategoryChange = (id: string) => {
    setActiveCat(id)
    setPage(1)
    const params = new URLSearchParams(searchParams.toString())
    if (id === 'all') params.delete('cat')
    else params.set('cat', id)
    params.delete('filter')
    const query = params.toString()
    router.replace(query ? `/accessories?${query}` : '/accessories', { scroll: false })
  }

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const sectionTitle =
    activeCat === 'all'
      ? 'All Accessories'
      : (ACCESSORIES_FILTER_CATEGORIES.find((item) => item.id === activeCat)?.label ?? 'Accessories')

  return (
    <section className="min-h-screen px-4 py-16 lg-page-bg">
      <div className="mx-auto max-w-7xl">
        <AccessoriesHero />
        <FeaturePills />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-12"
        >
          <LiquidGlassFilterRow
            items={filterItems}
            activeId={activeCat}
            goldActive
            onChange={handleCategoryChange}
            className="justify-center"
          />
        </motion.div>

        {paginated.length === 0 ? (
          <EmptyState
            category={activeCat}
            onReset={() => {
              setActiveCat('all')
              setPage(1)
            }}
          />
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2
                  className="text-3xl font-light text-[#111111]"
                  style={{ fontFamily: 'var(--font-cormorant, Georgia), serif' }}
                >
                  {sectionTitle}
                </h2>
                <p className="mt-1 text-sm text-[#6B6B6B]">
                  {filtered.length} items{total > filtered.length ? ` · ${total} in collection` : ''}
                </p>
              </div>
              <SortDropdown
                value={sort}
                onChange={(value) => {
                  setSort(value)
                  setPage(1)
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <AnimatePresence mode="popLayout">
                {paginated.map((product, index) => (
                  <AccessoryProductCard key={product.id} product={product} index={index} />
                ))}
              </AnimatePresence>
            </div>

            {totalPages > 1 ? (
              <LiquidGlassPagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                className="mt-10 justify-center"
              />
            ) : null}
          </>
        )}

        <BespokeCTA />
      </div>
    </section>
  )
}
