'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Award, ChevronRight, Heart, Shield, ShoppingBag, Sparkles, Truck } from 'lucide-react'
import {
  LiquidGlassFilterRow,
  LiquidGlassPagination,
  LiquidGlassPill,
} from '@/components/ui/LiquidGlass'
import { ACCESSORIES_FILTER_CATEGORIES } from '@/lib/storefront/accessories-nav'
import type { CatalogProduct } from '@/lib/catalog/live'
import { resolveQuickAddVariant } from '@/lib/catalog/index'
import { formatBDT } from '@/lib/utils/currency'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { cn } from '@/lib/utils/cn'
import { SplaroProductCard } from '@/components/product/ProductCard/SplaroProductCard'

const PAGE_SIZE = 12

const TRUST_BADGES = [
  { icon: Shield, label: 'Authentic quality' },
  { icon: Truck, label: 'Nationwide delivery' },
  { icon: Award, label: 'Curated edit' },
] as const

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
        addToCart({
          productId: product.id,
          quantity: 1,
          name: product.name,
          price: product.price,
          image: product.image,
          slug: product.slug,
          ...(variant ? { variantId: variant.id } : {}),
          ...(variant?.size ? { size: variant.size } : {}),
        })
      }}
      className="shop-bag-btn"
    >
      <ShoppingBag className="h-3.5 w-3.5" strokeWidth={2} />
    </button>
  )
}

function AccessoryProductCard({ product, index }: { product: CatalogProduct; index: number }) {
  const colorHexes = product.colorOptions?.map((c) => c.hex) ?? product.colors ?? []
  const collection = product.categoryName ?? product.category

  if (!product.image) {
    const hasDiscount = Boolean(product.compareAtPrice && product.compareAtPrice > product.price)
    return (
      <motion.article
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.3, delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }}
        className="group"
      >
        <div className="relative">
          <Link href={`/products/${product.slug}`} className="block text-inherit no-underline">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-white">
              <CategoryPlaceholder {...(product.categorySlug ? { categorySlug: product.categorySlug } : {})} />
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
    >
      <SplaroProductCard
        id={product.id}
        slug={product.slug}
        name={product.name}
        price={product.price}
        {...(product.compareAtPrice ? { compareAtPrice: product.compareAtPrice } : {})}
        image={product.image}
        {...(product.hoverImage ? { imageHover: product.hoverImage } : {})}
        {...(collection ? { collection } : {})}
        {...(product.code ? { productCode: product.code } : {})}
        colorHexes={colorHexes}
        status={product.status}
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
          {CATEGORY_EMOJI[category] ?? '✦'}
        </span>
        <h2 className="accessories-empty__title">
          {catalogEmpty
            ? 'No accessories live yet'
            : filteredEmpty
              ? `No ${label.toLowerCase()} in this edit yet`
              : 'Nothing matched this filter'}
        </h2>
        <p className="accessories-empty__body">
          {catalogEmpty
            ? 'Our accessories atelier is being curated. Every piece shown here will come from the live SPLARO catalog — nothing placeholder, nothing fake.'
            : filteredEmpty
              ? `We do not have published ${label.toLowerCase()} in the accessories collection right now. Browse the full edit or explore the main shop.`
              : 'Try another category or reset the filters to see what is currently live.'}
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

interface AccessoriesHeroProps {
  catalogTotal: number
}

function AccessoriesHero({ catalogTotal }: AccessoriesHeroProps) {
  return (
    <header className="accessories-hero">
      <p className="accessories-hero__eyebrow label-luxury">SPLARO Atelier</p>
      <div className="accessories-hero__head">
        <h1 className="accessories-hero__title">
          Accessories
          <span className="text-gold"> Edit</span>
        </h1>
        {catalogTotal > 0 ? (
          <p className="accessories-hero__count">
            {catalogTotal} live piece{catalogTotal === 1 ? '' : 's'}
          </p>
        ) : null}
      </div>
      <p className="accessories-hero__subtitle">
        Eyewear, leather, jewelry, and finishing pieces from our live catalog.
      </p>
      <div className="accessories-hero__badges">
        {TRUST_BADGES.map(({ icon: Icon, label }) => (
          <span key={label} className="shop-trust-badge">
            <Icon size={12} strokeWidth={2.2} className="text-gold" />
            {label}
          </span>
        ))}
      </div>
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

  const filterItems = useMemo(
    () =>
      ACCESSORIES_FILTER_CATEGORIES.map((cat) => {
        const count = countForCategory(products, cat.id)
        return {
          id: cat.id,
          label: count > 0 && cat.id !== 'all' ? `${cat.label} (${count})` : cat.label,
          emoji: cat.emoji,
          ...(count === 0 && cat.id !== 'all' && products.length > 0 ? { unavailable: true } : {}),
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

  const filterLabel =
    initialFilter === 'new'
      ? 'New arrivals'
      : initialFilter === 'bestsellers'
        ? 'Bestsellers'
        : null

  return (
    <section className="accessories-page">
      <div className="accessories-page__inner">
        <AccessoriesHero catalogTotal={total} />

        <div className="accessories-toolbar">
          <div className="accessories-toolbar__filters">
            <div className="accessories-toolbar__scroll">
              <LiquidGlassFilterRow
                items={filterItems}
                activeId={activeCat}
                goldActive
                onChange={handleCategoryChange}
                size="sm"
              />
            </div>
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
                  {filtered.length} live item{filtered.length === 1 ? '' : 's'}
                  {filterLabel ? ` · ${filterLabel}` : ''}
                  {total > filtered.length ? ` · ${total} in accessories collection` : ''}
                </p>
              </div>
              {filtered.length > PAGE_SIZE ? (
                <p className="accessories-grid-head__meta shrink-0">
                  Page {page} of {totalPages}
                </p>
              ) : null}
            </div>

            <div className="accessories-grid">
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
