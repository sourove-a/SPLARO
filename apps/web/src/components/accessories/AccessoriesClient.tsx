'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from '@/lib/motion/react'
import { ChevronRight, Heart, Sparkles } from 'lucide-react'
import { BagIcon } from '@/components/product/AddToBagIcon'
import {
  LiquidGlassFilterRow,
  LiquidGlassPagination,
  LiquidGlassPill,
} from '@/components/ui/LiquidGlass'
import { HorizontalScrollRail } from '@/components/ui/HorizontalScrollRail'
import { ACCESSORIES_FILTER_CATEGORIES } from '@/lib/storefront/accessories-nav'
import { safeClientNavigate } from '@/lib/navigation/safe-client-navigate'
import type { CatalogProduct } from '@/lib/catalog/live'
import { resolveQuickAddVariant } from '@/lib/catalog/index'
import { formatBDT } from '@/lib/utils/currency'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { cn } from '@/lib/utils/cn'
import { SplaroProductCard } from '@/components/product/ProductCard/SplaroProductCard'

const PAGE_SIZE = 12

type SortOption = 'newest' | 'price-asc' | 'price-desc'

/** Keyword fallback — live products often sit on parent slug `accessories`. */
const ACCESSORY_KEYWORDS: Record<string, string[]> = {
  glasses: ['glass', 'sunglass', 'eyewear', 'spectacle', 'optical', 'aviator'],
  watches: ['watch'],
  bags: ['bag', 'backpack', 'tote', 'duffel'],
  handbags: ['handbag', 'purse', 'clutch'],
  jewelry: ['jewel', 'necklace', 'earring', 'bracelet', 'ring'],
  wallets: ['wallet', 'cardholder'],
  scarves: ['scarf', 'hijab', 'stole'],
  belts: ['belt'],
  hats: ['hat', 'beanie', 'fedora'],
  'prayer-caps': ['prayer cap', 'prayer-cap', ' topi', 'kufi', 'prayercap'],
  'home-decor': ['decor', 'candle', 'frame', 'vase', 'home'],
}

function productAccessoryHaystack(product: CatalogProduct) {
  return `${product.name} ${product.slug} ${product.categorySlug ?? ''} ${product.categoryName ?? ''}`.toLowerCase()
}

function matchesAccessoryCategory(product: CatalogProduct, activeCat: string) {
  if (activeCat === 'all') return true
  const slug = (product.categorySlug ?? '').toLowerCase()
  if (
    slug === activeCat ||
    slug.startsWith(`${activeCat}-`) ||
    slug.endsWith(`-${activeCat}`)
  ) {
    return true
  }

  const hay = productAccessoryHaystack(product)
  const keywords = ACCESSORY_KEYWORDS[activeCat]
  if (!keywords?.length) return false

  if (activeCat === 'hats' && /prayer/.test(hay)) return false
  if (activeCat === 'bags' && /(wallet|watch|scarf|belt|prayer)/.test(hay)) return false
  if (activeCat === 'handbags' && /(backpack|wallet|watch)/.test(hay)) return false

  return keywords.some((keyword) => hay.includes(keyword))
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

/** Soft brand plate when a live product has no image — never emoji as product art. */
function CategoryPlaceholder() {
  return (
    <div
      className="accessories-media-placeholder flex h-full w-full flex-col items-center justify-center gap-2"
      aria-hidden
    >
      <span className="accessories-media-placeholder__mark">S</span>
      <span className="accessories-media-placeholder__label">SPLARO</span>
    </div>
  )
}

function WishlistButton({ productId }: { productId: string }) {
  const wishlistHydrated = useWishlistStore((s) => s._hydrated)
  const { toggleWishlist, isInWishlist } = useWishlistStore()
  const active = wishlistHydrated && isInWishlist(productId)

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
        const variant = resolveQuickAddVariant(product)
        const colorLabel =
          product.colorOptions?.find(
            (option) =>
              option.hex &&
              variant?.colorHex &&
              option.hex.toLowerCase() === variant.colorHex.toLowerCase(),
          )?.name ??
          product.colorOptions?.[0]?.name ??
          variant?.colorHex
        addToCart({
          productId: product.id,
          quantity: 1,
          name: product.name,
          price: product.price,
          image: product.image,
          slug: product.slug,
          ...(variant ? { variantId: variant.id } : {}),
          ...(variant?.size ? { size: variant.size } : {}),
          ...(colorLabel ? { color: colorLabel } : {}),
        })
      }}
      className="shop-bag-btn"
    >
      <BagIcon size={18} strokeWidth={1.37} plus />
    </button>
  )
}

function AccessoryProductCard({ product, index }: { product: CatalogProduct; index: number }) {
  const addToCart = useCartStore((state) => state.addItem)
  const colorHexes = product.colorOptions?.map((c) => c.hex) ?? product.colors ?? []

  if (!product.image) {
    const hasDiscount = Boolean(product.compareAtPrice && product.compareAtPrice > product.price)
    return (
      <motion.article
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.3, delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }}
        className="shop-product-grid__cell group min-w-0"
      >
        <div className="relative">
          <Link href={`/products/${product.slug}`} className="block text-inherit no-underline">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[14px] bg-white">
              <CategoryPlaceholder />
            </div>
            <div className="pt-3">
              <h3 className="line-clamp-2 text-[0.8125rem] font-semibold leading-snug text-[#111111]">
                {product.name}
              </h3>
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3, delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }}
      className="shop-product-grid__cell min-w-0"
    >
      <SplaroProductCard
        id={product.id}
        slug={product.slug}
        name={product.name}
        price={product.price}
        variant="shop"
        fit="contain"
        {...(product.compareAtPrice ? { compareAtPrice: product.compareAtPrice } : {})}
        image={product.image}
        {...(product.hoverImage ? { imageHover: product.hoverImage } : {})}
        {...(product.code ? { productCode: product.code } : {})}
        colorHexes={colorHexes}
        status={product.status}
        sizes={product.sizes}
        onAddToBag={() => {
          const variant = resolveQuickAddVariant(product)
          const colorLabel =
            product.colorOptions?.find(
              (option) =>
                option.hex &&
                variant?.colorHex &&
                option.hex.toLowerCase() === variant.colorHex.toLowerCase(),
            )?.name ??
            product.colorOptions?.[0]?.name ??
            variant?.colorHex
          addToCart({
            productId: product.id,
            quantity: 1,
            name: product.name,
            price: product.price,
            image: product.image,
            slug: product.slug,
            ...(variant ? { variantId: variant.id } : {}),
            ...(variant?.size ? { size: variant.size } : {}),
            ...(colorLabel ? { color: colorLabel } : {}),
          })
        }}
      />
    </motion.div>
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
    <label className="inline-flex shrink-0 items-center gap-2">
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

function AccessoriesEmptyState({
  category,
  catalogTotal,
  onReset,
}: {
  category: string
  catalogTotal: number
  onReset: () => void
}) {
  const label =
    ACCESSORIES_FILTER_CATEGORIES.find((item) => item.id === category)?.label ?? category
  const catalogEmpty = catalogTotal === 0
  const filteredEmpty = !catalogEmpty && category !== 'all'

  return (
    <div className="accessories-empty">
      <div className="accessories-empty__panel lg-glass-card">
        <span className="accessories-empty__mark" aria-hidden>
          S
        </span>
        <h2 className="accessories-empty__title">
          {catalogEmpty
            ? 'No accessories live yet'
            : filteredEmpty
              ? `No ${label.toLowerCase()} right now`
              : 'Nothing matched this filter'}
        </h2>
        <p className="accessories-empty__body">
          {catalogEmpty
            ? 'Accessories are not published in the live catalog yet. Check Shop or New arrivals for pieces that are live now.'
            : filteredEmpty
              ? `We do not have ${label.toLowerCase()} live right now. Browse all accessories or the main shop.`
              : 'Try another category or reset filters to see what is currently live.'}
        </p>
        <div className="accessories-empty__actions">
          <Link href="/shop" className="btn-luxury">
            Shop all
          </Link>
          <Link href="/new-arrivals" className="btn-luxury-outline">
            New arrivals
          </Link>
        </div>
        {filteredEmpty ? (
          <button type="button" className="accessories-empty__reset" onClick={onReset}>
            View all accessories
          </button>
        ) : null}
      </div>
    </div>
  )
}

function AccessoriesHero() {
  return (
    <header className="accessories-hero">
      <p className="accessories-hero__brand">SPLARO</p>
      <h1 className="accessories-hero__title">Accessories</h1>
      <div className="accessories-hero__rule" aria-hidden />
    </header>
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

  const filterItems = useMemo(() => {
    return ACCESSORIES_FILTER_CATEGORIES.filter((cat) => {
      if (cat.id === 'all') return true
      const count = countForCategory(products, cat.id)
      // Hide empty categories — keep the active one if deep-linked to an empty cat.
      return count > 0 || cat.id === activeCat
    }).map((cat) => {
      const count = countForCategory(products, cat.id)
      return {
        id: cat.id,
        label: count > 0 && cat.id !== 'all' ? `${cat.label} (${count})` : cat.label,
      }
    })
  }, [products, activeCat])

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
    safeClientNavigate(router, query ? `/accessories?${query}` : '/accessories', 'replace')
  }

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const sectionTitle =
    activeCat === 'all'
      ? 'All Accessories'
      : (ACCESSORIES_FILTER_CATEGORIES.find((item) => item.id === activeCat)?.label ?? 'Accessories')

  const filterLabel =
    initialFilter === 'new'
      ? 'New arrivals'
      : initialFilter === 'bestsellers'
        ? 'Bestsellers'
        : null

  return (
    <section className="accessories-page">
      <div className="accessories-page__inner">
        <AccessoriesHero />

        <div className="accessories-toolbar">
          <div className="accessories-toolbar__filters">
            <HorizontalScrollRail
              className="accessories-toolbar__rail"
              trackClassName="accessories-toolbar__scroll"
              variant="pill"
              hideArrows
              ariaLabel="Accessories categories"
            >
              <LiquidGlassFilterRow
                items={filterItems}
                activeId={activeCat}
                goldActive
                onChange={handleCategoryChange}
                size="sm"
              />
            </HorizontalScrollRail>
          </div>
          {filtered.length > 0 ? (
            <SortDropdown
              value={sort}
              onChange={(value) => {
                setSort(value)
                setPage(1)
              }}
            />
          ) : null}
        </div>

        {paginated.length === 0 ? (
          <AccessoriesEmptyState
            category={activeCat}
            catalogTotal={total}
            onReset={() => {
              handleCategoryChange('all')
            }}
          />
        ) : (
          <>
            <div className="accessories-grid-head">
              <div>
                <h2 className="accessories-grid-head__title">{sectionTitle}</h2>
                <p className="accessories-grid-head__meta">
                  {filtered.length} piece{filtered.length === 1 ? '' : 's'}
                  {filterLabel ? ` · ${filterLabel}` : ''}
                  {total > filtered.length ? ` · ${total} total` : ''}
                </p>
              </div>
              {filtered.length > PAGE_SIZE ? (
                <p className="accessories-grid-head__meta shrink-0">
                  Page {page} of {totalPages}
                </p>
              ) : null}
            </div>

            <div className="accessories-grid shop-product-grid">
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
                className="mt-8 justify-center"
              />
            ) : null}
          </>
        )}

        {total === 0 ? (
          <p className="mt-8 flex items-center justify-center gap-2 text-center text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-luxury-gray">
            <Sparkles className="h-3.5 w-3.5 text-gold" strokeWidth={2} />
            Catalog-connected · updates when accessories are published
          </p>
        ) : null}
      </div>
    </section>
  )
}
