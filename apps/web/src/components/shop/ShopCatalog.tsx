'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { ShopFilterBar } from '@/components/shop/ShopFilterBar'
import { SplaroProductCard } from '@/components/product/ProductCard/SplaroProductCard'
import { storefrontToCardData } from '@/lib/catalog/product-card-map'
import {
  buildListingSearchParams,
  LISTING_PAGE_SIZE,
} from '@/lib/catalog/listing'
import {
  isMobilePriceRangeActive,
  type CatalogSortOption,
} from '@/lib/shop/mobile-filter'
import { useCartStore } from '@/store/cartStore'
import { useUiStore } from '@/store/uiStore'
import { productSlug } from '@/lib/catalog/index'
import {
  colorGroup,
  getShopColorOptions,
  getShopSizeOptions,
  isStorefrontBestSeller,
  isStorefrontNewArrival,
  PRICE_FILTER_HIGH,
  PRICE_FILTER_LOW,
  shopFilterMenuCategories,
  type Category,
  type StorefrontProduct,
} from '@/data/storefront'
import { isStorefrontProductInStock, resolveQuickAddVariant } from '@/lib/catalog/index'
import { sanitizeStorefrontProduct } from '@/lib/assets/images'
import type { CachedCatalog, CatalogSource } from '@/lib/catalog/server'
import { usePublishedShopCategories } from '@/lib/storefront/catalog-channels'
import { useMobileViewport, useMounted } from '@/lib/hooks/use-mobile-viewport'
import { cn } from '@/lib/utils/cn'

const PAGE_SIZE = LISTING_PAGE_SIZE
const HOMEPAGE_PRODUCT_LIMIT = 8
const GRID_EASE = [0.16, 1, 0.3, 1] as const

type FilterKey = 'color' | 'size' | 'price' | 'sort' | null

export type ShopCatalogPreset = 'new-arrivals' | 'best-sellers'

interface ShopCatalogProps {
  initialCategory?: Category
  category?: Category
  onCategoryChange?: (category: Category) => void
  showStickyBar?: boolean
  initialCatalog?: CachedCatalog
  catalogPreset?: ShopCatalogPreset
  initialSort?: CatalogSortOption
  collectionSlug?: string
  categorySlug?: string
  listingMode?: 'full' | 'scoped'
  layout?: 'default' | 'homepage'
}

type ShopProduct = StorefrontProduct & { slug?: string }

function getProductHref(product: ShopProduct) {
  return `/products/${product.slug ?? productSlug(product)}`
}

export function ShopCatalog({
  initialCategory = 'All',
  category: controlledCategory,
  onCategoryChange,
  showStickyBar = true,
  initialCatalog,
  catalogPreset,
  initialSort = 'Default',
  collectionSlug,
  categorySlug,
  listingMode = 'full',
  layout = 'default',
}: ShopCatalogProps) {
  const isHomepage = layout === 'homepage'
  const isMobile = useMobileViewport()
  const mounted = useMounted()
  const homepageProductLimit = mounted && isMobile ? 6 : HOMEPAGE_PRODUCT_LIMIT
  const priorityCount = mounted && isMobile ? 2 : 4
  const reducedMotion = useReducedMotion()
  const addItem = useCartStore((state) => state.addItem)
  const setCartOpen = useUiStore((state) => state.setCartOpen)
  const useApiListing = listingMode === 'scoped' && Boolean(collectionSlug || categorySlug)

  const [activeCategory, setActiveCategory] = useState<Category>(initialCategory)
  const [openFilter, setOpenFilter] = useState<FilterKey>(null)
  const [selectedColor, setSelectedColor] = useState('All')
  const [selectedSize, setSelectedSize] = useState('All')
  const [selectedPrice, setSelectedPrice] = useState('All')
  const [mobilePriceMin, setMobilePriceMin] = useState<number | null>(null)
  const [mobilePriceMax, setMobilePriceMax] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<CatalogSortOption>(initialSort)
  const [catalogSource, setCatalogSource] = useState<CatalogSource>(initialCatalog?.source ?? 'api')
  const [catalogProducts, setCatalogProducts] = useState<ShopProduct[]>(
    (initialCatalog?.products ?? []).map(sanitizeStorefrontProduct),
  )
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [apiPage, setApiPage] = useState(initialCatalog?.page ?? 1)
  const [apiTotalPages, setApiTotalPages] = useState(initialCatalog?.totalPages ?? 1)
  const [loadingMore, setLoadingMore] = useState(false)
  const visibleCategories = usePublishedShopCategories()

  useEffect(() => {
    if (initialCatalog?.source === 'api') return
    fetch('/api/products', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { products?: StorefrontProduct[]; source?: CatalogSource }) => {
        if (data.source) setCatalogSource(data.source)
        if (data.source === 'api' && data.products?.length) {
          setCatalogProducts(data.products.map(sanitizeStorefrontProduct))
        }
      })
      .catch(() => setCatalogSource('api-unavailable'))
  }, [initialCatalog?.source])

  useEffect(() => {
    if (!initialCatalog) return
    setCatalogSource(initialCatalog.source)
    setCatalogProducts(initialCatalog.products.map(sanitizeStorefrontProduct))
    setApiPage(initialCatalog.page ?? 1)
    setApiTotalPages(initialCatalog.totalPages ?? 1)
    setVisibleCount(PAGE_SIZE)
  }, [initialCatalog])

  useEffect(() => {
    if (controlledCategory !== undefined) return
    setActiveCategory(initialCategory)
  }, [initialCategory, controlledCategory])

  const currentCategory = controlledCategory ?? activeCategory

  useEffect(() => {
    if (controlledCategory !== undefined) return
    if (!visibleCategories.includes(currentCategory)) {
      setActiveCategory('All')
    }
  }, [visibleCategories, currentCategory, controlledCategory])

  const updateCategory = (category: Category) => {
    if (controlledCategory === undefined) setActiveCategory(category)
    onCategoryChange?.(category)
    setOpenFilter(null)
    setSelectedColor('All')
    setSelectedSize('All')
    setVisibleCount(PAGE_SIZE)
  }

  const addProductToBag = (
    product: ShopProduct,
    size = product.sizes[0],
    color = product.colors[0],
    openCart = true,
  ) => {
    const variant = resolveQuickAddVariant(product, size, color)
    addItem({
      productId: product.id,
      quantity: 1,
      name: product.name,
      price: product.price,
      image: product.image,
      slug: product.slug ?? productSlug(product),
      ...(variant ? { variantId: variant.id } : {}),
      ...(variant?.size ?? size ? { size: variant?.size ?? size } : {}),
      ...(color ? { color } : {}),
    })
    if (openCart) setCartOpen(true)
  }

  const catalogPriceBounds = useMemo(() => {
    const prices = catalogProducts.map((product) => product.price)
    if (!prices.length) return { min: 0, max: 50000 }
    const min = Math.floor(Math.min(...prices) / 100) * 100
    const max = Math.ceil(Math.max(...prices) / 100) * 100
    return { min, max: Math.max(max, min + 1000) }
  }, [catalogProducts])

  const mobilePriceRangeActive = isMobilePriceRangeActive(
    mobilePriceMin,
    mobilePriceMax,
    catalogPriceBounds,
  )

  const filteredProducts = useMemo(() => {
    const visible = catalogProducts.filter((product) => {
      if (catalogPreset === 'new-arrivals' && !isStorefrontNewArrival(product)) return false
      if (catalogPreset === 'best-sellers' && !isStorefrontBestSeller(product)) return false
      const categoryMatch = currentCategory === 'All' || product.category === currentCategory
      const sizeMatch = selectedSize === 'All' || product.sizes.includes(selectedSize)
      const colorMatch =
        selectedColor === 'All' ||
        product.colors.some((color) => colorGroup(color) === selectedColor)
      const productPrice = product.price
      const priceMatch = mobilePriceRangeActive
        ? productPrice >= (mobilePriceMin ?? catalogPriceBounds.min) &&
          productPrice <= (mobilePriceMax ?? catalogPriceBounds.max)
        : selectedPrice === 'All' ||
          (selectedPrice === 'Under BDT 6,000' && productPrice < PRICE_FILTER_LOW) ||
          (selectedPrice === 'BDT 6,000 – 10,000' &&
            productPrice >= PRICE_FILTER_LOW &&
            productPrice <= PRICE_FILTER_HIGH) ||
          (selectedPrice === 'Above BDT 10,000' && productPrice > PRICE_FILTER_HIGH)
      return categoryMatch && sizeMatch && colorMatch && priceMatch
    })

    return [...visible].sort((a, b) => {
      if (sortBy === 'Best Selling') {
        const bestDiff =
          Number(isStorefrontBestSeller(b)) - Number(isStorefrontBestSeller(a))
        if (bestDiff !== 0) return bestDiff
        return 0
      }
      if (sortBy === 'Price low to high') return a.price - b.price
      if (sortBy === 'Price high to low') return b.price - a.price
      if (sortBy === 'Newest') return b.id.localeCompare(a.id)
      return 0
    })
  }, [
    catalogPreset,
    catalogPriceBounds.max,
    catalogPriceBounds.min,
    catalogProducts,
    currentCategory,
    mobilePriceMax,
    mobilePriceMin,
    mobilePriceRangeActive,
    selectedColor,
    selectedPrice,
    selectedSize,
    sortBy,
  ])

  const visibleProducts = useMemo(() => {
    const slice = filteredProducts.slice(0, visibleCount)
    return isHomepage ? slice.slice(0, homepageProductLimit) : slice
  }, [filteredProducts, homepageProductLimit, isHomepage, visibleCount])

  const gridAnimationKey = useMemo(
    () =>
      [
        currentCategory,
        selectedColor,
        selectedSize,
        selectedPrice,
        sortBy,
        mobilePriceMin ?? '',
        mobilePriceMax ?? '',
      ].join('|'),
    [
      currentCategory,
      mobilePriceMax,
      mobilePriceMin,
      selectedColor,
      selectedPrice,
      selectedSize,
      sortBy,
    ],
  )

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [currentCategory, mobilePriceMax, mobilePriceMin, selectedColor, selectedPrice, selectedSize, sortBy])

  const sizeOptions = useMemo(
    () => getShopSizeOptions(catalogProducts, currentCategory),
    [catalogProducts, currentCategory],
  )

  const colorOptions = useMemo(
    () => getShopColorOptions(catalogProducts, currentCategory),
    [catalogProducts, currentCategory],
  )

  useEffect(() => {
    if (sizeOptions.includes(selectedSize)) return
    setSelectedSize('All')
  }, [sizeOptions, selectedSize])

  useEffect(() => {
    if (colorOptions.includes(selectedColor)) return
    setSelectedColor('All')
  }, [colorOptions, selectedColor])

  const clearFilters = () => {
    if (controlledCategory === undefined) setActiveCategory('All')
    onCategoryChange?.('All')
    setSelectedColor('All')
    setSelectedSize('All')
    setSelectedPrice('All')
    setMobilePriceMin(null)
    setMobilePriceMax(null)
    setSortBy('Default')
    setOpenFilter(null)
    setVisibleCount(PAGE_SIZE)
  }

  const fetchMoreFromApi = useCallback(async () => {
    if (!useApiListing || loadingMore || apiPage >= apiTotalPages) return false

    setLoadingMore(true)
    try {
      const nextPage = apiPage + 1
      const params = buildListingSearchParams({
        page: nextPage,
        limit: PAGE_SIZE,
        ...(collectionSlug ? { collectionSlug } : {}),
        ...(categorySlug ? { categorySlug } : {}),
      })
      const res = await fetch(`/api/products?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) return false
      const data = (await res.json()) as {
        products?: ShopProduct[]
        totalPages?: number
        page?: number
      }
      const incoming = (data.products ?? []).map(sanitizeStorefrontProduct)
      if (!incoming.length) return false

      setCatalogProducts((current) => {
        const seen = new Set(current.map((product) => product.id))
        const merged = [...current]
        for (const product of incoming) {
          if (!seen.has(product.id)) merged.push(product)
        }
        return merged
      })
      setApiPage(data.page ?? nextPage)
      setApiTotalPages(data.totalPages ?? apiTotalPages)
      return true
    } catch {
      return false
    } finally {
      setLoadingMore(false)
    }
  }, [
    apiPage,
    apiTotalPages,
    categorySlug,
    collectionSlug,
    loadingMore,
    useApiListing,
  ])

  const handleLoadMore = async () => {
    if (useApiListing && apiPage < apiTotalPages) {
      const loaded = await fetchMoreFromApi()
      if (loaded) {
        setVisibleCount((count) => count + PAGE_SIZE)
        return
      }
    }
    setVisibleCount((count) => count + PAGE_SIZE)
  }

  const canLoadMore = isHomepage
    ? false
    : useApiListing
      ? filteredProducts.length > visibleCount || apiPage < apiTotalPages
      : filteredProducts.length > visibleCount

  return (
    <>
      <section
        id="products"
        data-section="shopCatalog"
        className={cn('shop-catalog', isHomepage && 'shop-catalog--homepage')}
      >
        {catalogSource === 'api-unavailable' ? (
          <div className="mb-4 px-3 sm:px-5 lg:px-8">
            <p className="auth-form__error">
              Product catalog is temporarily offline — live inventory could not be loaded. Please refresh or try again shortly.
            </p>
          </div>
        ) : null}
        {showStickyBar ? (
          <ShopFilterBar
            categories={shopFilterMenuCategories}
            activeCategory={currentCategory}
            onCategoryChange={updateCategory}
            colorOptions={colorOptions}
            sizeOptions={sizeOptions}
            selectedColor={selectedColor}
            selectedSize={selectedSize}
            selectedPrice={selectedPrice}
            sortBy={sortBy}
            priceBounds={catalogPriceBounds}
            priceMin={mobilePriceMin}
            priceMax={mobilePriceMax}
            resultCount={filteredProducts.length}
            openFilter={openFilter}
            onOpenFilterChange={setOpenFilter}
            onColorChange={setSelectedColor}
            onSizeChange={setSelectedSize}
            onPriceChange={setSelectedPrice}
            onPriceRangeChange={(min, max) => {
              setMobilePriceMin(min)
              setMobilePriceMax(max)
            }}
            onSortChange={setSortBy}
            onClearFilters={clearFilters}
          />
        ) : null}

        {(selectedColor !== 'All' ||
          selectedSize !== 'All' ||
          selectedPrice !== 'All' ||
          mobilePriceRangeActive ||
          sortBy !== 'Default') && (
          <div className="shop-active-chips">
            {selectedColor !== 'All' ? (
              <button
                type="button"
                className="shop-active-chip"
                onClick={() => setSelectedColor('All')}
              >
                {selectedColor} <X className="h-3 w-3" />
              </button>
            ) : null}
            {selectedSize !== 'All' ? (
              <button
                type="button"
                className="shop-active-chip"
                onClick={() => setSelectedSize('All')}
              >
                Size {selectedSize} <X className="h-3 w-3" />
              </button>
            ) : null}
            {mobilePriceRangeActive ? (
              <button
                type="button"
                className="shop-active-chip"
                onClick={() => {
                  setMobilePriceMin(null)
                  setMobilePriceMax(null)
                }}
              >
                Price range <X className="h-3 w-3" />
              </button>
            ) : null}
            {selectedPrice !== 'All' ? (
              <button
                type="button"
                className="shop-active-chip"
                onClick={() => setSelectedPrice('All')}
              >
                {selectedPrice} <X className="h-3 w-3" />
              </button>
            ) : null}
            {sortBy !== 'Default' ? (
              <button type="button" className="shop-active-chip" onClick={() => setSortBy('Default')}>
                {sortBy} <X className="h-3 w-3" />
              </button>
            ) : null}
            <button type="button" className="shop-clear-link" onClick={clearFilters}>
              Clear
            </button>
          </div>
        )}

        <div className={cn('shop-product-grid', isHomepage && 'shop-product-grid--homepage')}>
          <AnimatePresence mode="popLayout" initial={false}>
            {visibleProducts.map((product, index) => {
              const card = storefrontToCardData(product)
              const motionProps = reducedMotion
                ? { initial: false as const }
                : {
                    initial: { opacity: 0, y: 12, scale: 0.988 },
                    animate: { opacity: 1, y: 0, scale: 1 },
                    exit: { opacity: 0, y: -8, scale: 0.988 },
                    transition: {
                      duration: 0.34,
                      delay: Math.min(index * 0.038, 0.28),
                      ease: GRID_EASE,
                    },
                  }

              return (
                <motion.div
                  key={`${gridAnimationKey}:${product.id}`}
                  className="shop-product-grid__cell min-w-0"
                  layout={false}
                  {...motionProps}
                >
                  <SplaroProductCard
                    id={card.id}
                    slug={card.slug}
                    name={card.name}
                    price={card.price}
                    variant={isHomepage ? 'homepage' : 'shop'}
                    fit="contain"
                    {...(card.compareAtPrice ? { compareAtPrice: card.compareAtPrice } : {})}
                    image={card.images[0] ?? ''}
                    {...(card.images[1] ? { imageHover: card.images[1] } : {})}
                    {...(product.code ? { productCode: product.code } : {})}
                    colorHexes={product.colors}
                    status={product.status}
                    inStock={product.inStock ?? isStorefrontProductInStock(product)}
                    sizes={product.sizes}
                    href={getProductHref(product)}
                    priority={index < priorityCount}
                    onAddToBag={() =>
                      addProductToBag(product, product.sizes[0], product.colors[0], true)
                    }
                  />
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {canLoadMore ? (
          <div className="shop-load-more-wrap mt-8">
            <button
              type="button"
              className="shop-load-more-btn"
              disabled={loadingMore}
              onClick={() => void handleLoadMore()}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        ) : null}

        {filteredProducts.length === 0 && catalogSource !== 'api-unavailable' ? (
          <div className="shop-empty glass-tile">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-black/40">
              No products found
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-normal text-black">
              Try a different filter or category.
            </h2>
            <button type="button" className="glass-action glass-action-dark mt-5" onClick={clearFilters}>
              Clear filters
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </section>
    </>
  )
}
