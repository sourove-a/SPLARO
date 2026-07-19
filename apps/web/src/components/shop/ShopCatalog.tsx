'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from '@/lib/motion/react'
import { X } from 'lucide-react'
import { useMotionReady } from '@/hooks/useMotionReady'
import { ShopFilterBar, type ShopGridDensity } from '@/components/shop/ShopFilterBar'
import { SplaroProductCard } from '@/components/product/ProductCard/SplaroProductCard'
import { ProductCardSkeleton } from '@/components/product/ProductCard/ProductCardSkeleton'
import { buildQuickViewProduct } from '@/lib/catalog/quick-view-product'
import { storefrontToCardData } from '@/lib/catalog/product-card-map'
import {
  buildListingSearchParams,
  LISTING_PAGE_SIZE,
} from '@/lib/catalog/listing'
import {
  isMobilePriceRangeActive,
  isDefaultSort,
  type CatalogSortOption,
} from '@/lib/shop/mobile-filter'
import {
  compareProductsBySort,
  findPriceBandByLabel,
  getDefaultPriceLabel,
  getDefaultSortLabel,
  matchesPriceBand,
} from '@/lib/shop/filter-config'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { useCartStore } from '@/store/cartStore'
import { useUiStore } from '@/store/uiStore'
import { productSlug } from '@/lib/catalog/index'
import {
  colorGroup,
  getShopColorOptions,
  getShopSizeOptions,
  isStorefrontBestSeller,
  isStorefrontNewArrival,
  type Category,
  type StorefrontProduct,
} from '@/data/storefront'
import { isStorefrontProductInStock, resolveQuickAddVariant } from '@/lib/catalog/index'
import { sanitizeStorefrontProduct } from '@/lib/assets/images'
import { sanitizeStorefrontProductCode } from '@/lib/catalog/storefront-sanitize'
import type { CachedCatalog, CatalogSource } from '@/lib/catalog/server'
import { useCatalogChannels } from '@/lib/storefront/catalog-channels'
import { deriveShopFilterCategories } from '@/lib/catalog/shop-categories'
import { useMobileViewport, useMounted } from '@/lib/hooks/use-mobile-viewport'
import { cn } from '@/lib/utils/cn'

const ProductQuickView = dynamic(
  () =>
    import('@/components/product/ProductQuickView/ProductQuickView').then((m) => m.ProductQuickView),
  { ssr: false },
)

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
  parentCategorySlug?: string
  categorySlug?: string
  listingMode?: 'full' | 'scoped' | 'paged'
  layout?: 'default' | 'homepage'
}

type ShopProduct = StorefrontProduct & { slug?: string }

function getProductHref(product: ShopProduct) {
  return `/products/${product.slug ?? productSlug(product)}`
}

function resolveCardProductCode(product: ShopProduct) {
  const direct = product.code?.trim()
  if (direct) return direct
  const sku = sanitizeStorefrontProductCode(
    (product as ShopProduct & { sku?: string }).sku,
    product.slug ?? productSlug(product),
  )
  if (sku) return sku
  return product.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || undefined
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
  parentCategorySlug,
  categorySlug,
  listingMode = 'full',
  layout = 'default',
}: ShopCatalogProps) {
  const isHomepage = layout === 'homepage'
  const isMobile = useMobileViewport()
  const mounted = useMounted()
  const router = useRouter()
  const homepageProductLimit = HOMEPAGE_PRODUCT_LIMIT
  const priorityCount = mounted && isMobile ? 2 : 4
  const { allowRevealAnimation, showMotion } = useMotionReady()
  const addItem = useCartStore((state) => state.addItem)
  const setCartOpen = useUiStore((state) => state.setCartOpen)
  const scopedParentSlug = parentCategorySlug || collectionSlug
  const useApiListing =
    listingMode === 'paged' ||
    (listingMode === 'scoped' && Boolean(scopedParentSlug || categorySlug))
  const { config } = useStorefrontSettings()
  const shopFilters = config.shopFilters!
  const defaultSortLabel = getDefaultSortLabel(shopFilters)
  const defaultPriceLabel = getDefaultPriceLabel(shopFilters)

  const [activeCategory, setActiveCategory] = useState<Category>(initialCategory)
  const [openFilter, setOpenFilter] = useState<FilterKey>(null)
  const [selectedColor, setSelectedColor] = useState('All')
  const [selectedSize, setSelectedSize] = useState('All')
  const [selectedPrice, setSelectedPrice] = useState(() => getDefaultPriceLabel(shopFilters))
  const [mobilePriceMin, setMobilePriceMin] = useState<number | null>(null)
  const [mobilePriceMax, setMobilePriceMax] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<CatalogSortOption>(() =>
    initialSort === 'Default' ? getDefaultSortLabel(shopFilters) : initialSort,
  )
  const [catalogSource, setCatalogSource] = useState<CatalogSource>(initialCatalog?.source ?? 'api')
  const [catalogProducts, setCatalogProducts] = useState<ShopProduct[]>(
    (initialCatalog?.products ?? []).map(sanitizeStorefrontProduct),
  )
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [apiPage, setApiPage] = useState(initialCatalog?.page ?? 1)
  const [apiTotalPages, setApiTotalPages] = useState(initialCatalog?.totalPages ?? 1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isCatalogLoading, setIsCatalogLoading] = useState(() => {
    const hasProducts = (initialCatalog?.products?.length ?? 0) > 0
    if (hasProducts) return false
    if (initialCatalog?.source === 'empty' || initialCatalog?.source === 'api-unavailable') {
      return false
    }
    return true
  })
  /** Optimistic skeleton while category pills navigate to /c/* (Next can skip loading.tsx when prefetched). */
  const [isNavPending, setIsNavPending] = useState(false)
  const [quickViewProduct, setQuickViewProduct] = useState<ShopProduct | null>(null)
  const [gridDensity, setGridDensity] = useState<ShopGridDensity>(2)
  const loadMoreSkeletonCount = gridDensity === 1 ? 2 : 4
  const showProductSkeleton =
    isNavPending || (isCatalogLoading && catalogProducts.length === 0)
  const catalogProductsRef = useRef(catalogProducts)
  catalogProductsRef.current = catalogProducts
  const catalogChannels = useCatalogChannels()
  const filterCategories = useMemo(
    () => deriveShopFilterCategories(catalogChannels, catalogProducts),
    [catalogChannels, catalogProducts],
  )
  const [, startFilterTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    const MAX_ATTEMPTS = 2

    const applyCatalog = (data: { products?: StorefrontProduct[]; source?: CatalogSource }) => {
      if (data.products?.length) {
        setCatalogProducts(data.products.map(sanitizeStorefrontProduct))
        setCatalogSource('api')
        setIsCatalogLoading(false)
        return true
      }
      if (data.source && data.source !== 'api-unavailable') {
        setCatalogSource(data.source)
      }
      return false
    }

    const load = async (attempt = 0) => {
      try {
        // Paged / scoped PLP must never hit unscoped /api/products (full catalog dump).
        const listingParams = useApiListing
          ? buildListingSearchParams({
              page: 1,
              limit: PAGE_SIZE,
              ...(scopedParentSlug ? { parentCategorySlug: scopedParentSlug } : {}),
              ...(categorySlug && categorySlug !== scopedParentSlug
                ? { categorySlug }
                : {}),
            })
          : null
        const res = await fetch(
          listingParams ? `/api/products?${listingParams.toString()}` : '/api/products',
          { cache: 'no-store' },
        )
        const data = (await res.json()) as {
          products?: StorefrontProduct[]
          source?: CatalogSource
          totalPages?: number
          page?: number
        }
        if (cancelled) return
        if (applyCatalog(data)) {
          if (useApiListing) {
            setApiPage(data.page ?? 1)
            setApiTotalPages(data.totalPages ?? 1)
          }
          return
        }
        if ((data.source === 'api-unavailable' || !res.ok) && attempt < MAX_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)))
          return load(attempt + 1)
        }
        // Honest empty vs offline — never label a successful empty catalog as API down.
        if (!catalogProductsRef.current.length) {
          setCatalogSource(
            !res.ok || data.source === 'api-unavailable' ? 'api-unavailable' : data.source ?? 'empty',
          )
        }
        setIsCatalogLoading(false)
      } catch {
        if (cancelled) return
        if (attempt < MAX_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)))
          return load(attempt + 1)
        }
        if (!catalogProductsRef.current.length) {
          setCatalogSource('api-unavailable')
        }
        setIsCatalogLoading(false)
      }
    }

    const hasSsrCatalog =
      initialCatalog?.source === 'api' && (initialCatalog.products?.length ?? 0) > 0

    // Homepage preview is fixed at 8 — skip idle full-catalog refresh (Instagram-style).
    if (isHomepage && hasSsrCatalog) {
      setIsCatalogLoading(false)
      return () => {
        cancelled = true
      }
    }

    if (hasSsrCatalog) {
      // The SSR payload is already the requested catalog. Re-fetching the full
      // listing immediately after hydration duplicates transfer and API work.
      setIsCatalogLoading(false)
      return () => {
        cancelled = true
      }
    }

    // Empty scoped SSR stays empty/scoped — do not fall through to full shop.
    setIsCatalogLoading(true)
    void load()
    return () => {
      cancelled = true
    }
  }, [
    initialCatalog?.source,
    initialCatalog?.products.length,
    isHomepage,
    useApiListing,
    scopedParentSlug,
    categorySlug,
  ])

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
    if (!filterCategories.includes(currentCategory)) {
      setActiveCategory('All')
    }
  }, [filterCategories, currentCategory, controlledCategory])

  const updateCategory = (category: Category) => {
    // Paged /shop: navigate to department PLP instead of filtering a full dump in-memory.
    if (listingMode === 'paged') {
      if (category === 'All') {
        if (controlledCategory === undefined) setActiveCategory('All')
        onCategoryChange?.('All')
        startFilterTransition(() => {
          setOpenFilter(null)
          setSelectedColor('All')
          setSelectedSize('All')
          setVisibleCount(PAGE_SIZE)
        })
        return
      }
      const href = catalogChannels.find((channel) => channel.shopCategory === category)?.href
      if (href) {
        // Paint skeleton first — prefetched RSC can swap pages before loading.tsx appears.
        setIsNavPending(true)
        requestAnimationFrame(() => {
          startFilterTransition(() => {
            router.push(href)
          })
        })
        return
      }
    }

    if (controlledCategory === undefined) setActiveCategory(category)
    onCategoryChange?.(category)
    startFilterTransition(() => {
      setOpenFilter(null)
      setSelectedColor('All')
      setSelectedSize('All')
      setVisibleCount(PAGE_SIZE)
    })
  }

  const addProductToBag = (
    product: ShopProduct,
    size = product.sizes[0],
    color = product.colors[0],
    openCart = true,
  ) => {
    const variant = resolveQuickAddVariant(product, size, color)
    const colorHex = (variant?.colorHex ?? color)?.toLowerCase()
    const colorLabel =
      product.colorOptions?.find((option) => option.hex.toLowerCase() === colorHex)?.name ??
      colorHex
    addItem({
      productId: product.id,
      quantity: 1,
      name: product.name,
      price: product.price,
      image: product.image,
      slug: product.slug ?? productSlug(product),
      ...(variant ? { variantId: variant.id } : {}),
      ...(variant?.size ?? size ? { size: variant?.size ?? size } : {}),
      ...(colorLabel ? { color: colorLabel } : {}),
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
      const priceBand = findPriceBandByLabel(shopFilters, selectedPrice)
      const priceMatch = mobilePriceRangeActive
        ? productPrice >= (mobilePriceMin ?? catalogPriceBounds.min) &&
          productPrice <= (mobilePriceMax ?? catalogPriceBounds.max)
        : !priceBand || priceBand.id === 'all'
          ? true
          : matchesPriceBand(productPrice, priceBand)
      return categoryMatch && sizeMatch && colorMatch && priceMatch
    })

    return [...visible].sort((a, b) =>
      compareProductsBySort(a, b, sortBy, shopFilters, (product) =>
        isStorefrontBestSeller(product as StorefrontProduct),
      ),
    )
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
    shopFilters,
    sortBy,
  ])

  const visibleProducts = useMemo(() => {
    const slice = filteredProducts.slice(0, visibleCount)
    return isHomepage ? slice.slice(0, homepageProductLimit) : slice
  }, [filteredProducts, homepageProductLimit, isHomepage, visibleCount])

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
    startFilterTransition(() => {
      setSelectedColor('All')
      setSelectedSize('All')
      setSelectedPrice(defaultPriceLabel)
      setMobilePriceMin(null)
      setMobilePriceMax(null)
      setSortBy(defaultSortLabel)
      setOpenFilter(null)
      setVisibleCount(PAGE_SIZE)
    })
  }

  const applyFilterChange = useCallback(
    (update: () => void) => {
      startFilterTransition(update)
    },
    [startFilterTransition],
  )

  const fetchMoreFromApi = useCallback(async () => {
    if (!useApiListing || loadingMore || apiPage >= apiTotalPages) return false

    setLoadingMore(true)
    try {
      const nextPage = apiPage + 1
      const params = buildListingSearchParams({
        page: nextPage,
        limit: PAGE_SIZE,
        ...(scopedParentSlug ? { parentCategorySlug: scopedParentSlug } : {}),
        ...(categorySlug && categorySlug !== scopedParentSlug ? { categorySlug } : {}),
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
    scopedParentSlug,
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

  const hasActiveFilters =
    currentCategory !== 'All' ||
    selectedColor !== 'All' ||
    selectedSize !== 'All' ||
    selectedPrice !== defaultPriceLabel ||
    mobilePriceRangeActive ||
    !isDefaultSort(sortBy, shopFilters)

  const catalogIsEmpty = catalogProducts.length === 0 && catalogSource === 'empty'

  const gridFilterKey = [
    currentCategory,
    selectedColor,
    selectedSize,
    selectedPrice,
    sortBy,
    mobilePriceMin,
    mobilePriceMax,
  ].join('|')

  // Full catalog grids (shop/collections) skip the entrance stagger — with 18+
  // cards the per-card motion.div setup cost was the largest Shop TBT driver.
  // Homepage keeps it (fixed 8-item preview, cheap, already fast).
  const animateGrid = isHomepage && showMotion && allowRevealAnimation
  const useLiteGridMotion =
    typeof document !== 'undefined' &&
    (document.documentElement.getAttribute('data-os') === 'windows' ||
      document.documentElement.getAttribute('data-perf') === 'lite')

  return (
    <>
      <section
        id="products"
        data-section="shopCatalog"
        className={cn('shop-catalog', isHomepage && 'shop-catalog--homepage')}
      >
        {catalogSource === 'api-unavailable' && catalogProducts.length === 0 ? (
          <div className="mb-4 px-3 sm:px-5 lg:px-8">
            <p className="auth-form__error">
              Product catalog is temporarily offline — live inventory could not be loaded. Please refresh or try again shortly.
            </p>
          </div>
        ) : null}
        {showStickyBar ? (
          <ShopFilterBar
            categories={filterCategories}
            activeCategory={currentCategory}
            onCategoryChange={updateCategory}
            showCategoryNav={listingMode !== 'scoped'}
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
            onColorChange={(value) => applyFilterChange(() => setSelectedColor(value))}
            onSizeChange={(value) => applyFilterChange(() => setSelectedSize(value))}
            onPriceChange={(value) => applyFilterChange(() => setSelectedPrice(value))}
            onPriceRangeChange={(min, max) => {
              applyFilterChange(() => {
                setMobilePriceMin(min)
                setMobilePriceMax(max)
              })
            }}
            onSortChange={(value) => applyFilterChange(() => setSortBy(value))}
            onClearFilters={clearFilters}
            gridDensity={gridDensity}
            onGridDensityChange={setGridDensity}
          />
        ) : null}

        <AnimatePresence initial={false}>
          {hasActiveFilters ? (
            <motion.div
              key="active-chips"
              className="shop-active-chips"
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: GRID_EASE }}
            >
              {selectedColor !== 'All' ? (
                <motion.button
                  type="button"
                  className="shop-active-chip"
                  onClick={() => setSelectedColor('All')}
                  layout
                  whileTap={{ opacity: 0.96 }}
                >
                  {selectedColor} <X className="h-3 w-3" />
                </motion.button>
              ) : null}
              {selectedSize !== 'All' ? (
                <motion.button
                  type="button"
                  className="shop-active-chip"
                  onClick={() => setSelectedSize('All')}
                  layout
                  whileTap={{ opacity: 0.96 }}
                >
                  Size {selectedSize} <X className="h-3 w-3" />
                </motion.button>
              ) : null}
              {mobilePriceRangeActive ? (
                <motion.button
                  type="button"
                  className="shop-active-chip"
                  onClick={() => {
                    setMobilePriceMin(null)
                    setMobilePriceMax(null)
                  }}
                  layout
                  whileTap={{ opacity: 0.96 }}
                >
                  Price range <X className="h-3 w-3" />
                </motion.button>
              ) : null}
              {selectedPrice !== defaultPriceLabel ? (
                <motion.button
                  type="button"
                  className="shop-active-chip"
                  onClick={() => setSelectedPrice(defaultPriceLabel)}
                  layout
                  whileTap={{ opacity: 0.96 }}
                >
                  {selectedPrice} <X className="h-3 w-3" />
                </motion.button>
              ) : null}
              {!isDefaultSort(sortBy, shopFilters) ? (
                <motion.button
                  type="button"
                  className="shop-active-chip"
                  onClick={() => setSortBy(defaultSortLabel)}
                  layout
                  whileTap={{ opacity: 0.96 }}
                >
                  {sortBy} <X className="h-3 w-3" />
                </motion.button>
              ) : null}
              <button type="button" className="shop-clear-link" onClick={clearFilters}>
                Clear
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {showProductSkeleton ? (
          <div
            className={cn(
              'shop-product-grid shop-product-grid--skeleton',
              isHomepage && 'shop-product-grid--homepage',
              !isHomepage && gridDensity === 1 && 'shop-product-grid--cols-1',
              !isHomepage && gridDensity === 2 && 'shop-product-grid--cols-2',
            )}
            aria-busy="true"
            aria-label="Loading products"
          >
            {Array.from({ length: isHomepage ? 8 : Math.min(PAGE_SIZE, 8) }, (_, index) => (
              <div key={`catalog-skeleton-${index}`} className="shop-product-grid__cell min-w-0">
                <ProductCardSkeleton />
              </div>
            ))}
          </div>
        ) : animateGrid ? (
          <motion.div
            key={gridFilterKey}
            className={cn(
              'shop-product-grid',
              !isHomepage && 'shop-product-grid--soft-enter',
              isHomepage && 'shop-product-grid--homepage',
              !isHomepage && gridDensity === 1 && 'shop-product-grid--cols-1',
              !isHomepage && gridDensity === 2 && 'shop-product-grid--cols-2',
            )}
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.24, ease: GRID_EASE }}
          >
            {visibleProducts.map((product, index) => {
              const card = storefrontToCardData(product)
              const motionProps = useLiteGridMotion
                ? {
                    initial: { opacity: 0 },
                    animate: { opacity: 1 },
                    transition: {
                      duration: 0.18,
                      delay: Math.min(index * 0.012, 0.08),
                      ease: GRID_EASE,
                    },
                  }
                : {
                    initial: { opacity: 0, y: 12 },
                    animate: { opacity: 1, y: 0 },
                    transition: {
                      duration: 0.3,
                      delay: Math.min(index * 0.028, 0.2),
                      ease: GRID_EASE,
                    },
                  }
              const cardCode = resolveCardProductCode(product)

              return (
                <motion.div
                  key={product.id}
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
                    {...(card.images.length > 2 ? { galleryImages: card.images } : {})}
                    {...(cardCode ? { productCode: cardCode } : {})}
                    colorHexes={product.colors}
                    status={product.status}
                    inStock={product.inStock ?? isStorefrontProductInStock(product)}
                    sizes={product.sizes}
                    href={getProductHref(product)}
                    priority={index < priorityCount}
                    onAddToBag={() =>
                      addProductToBag(product, product.sizes[0], product.colors[0], true)
                    }
                    onShowDetails={() => setQuickViewProduct(product)}
                  />
                </motion.div>
              )
            })}
            {loadingMore
              ? Array.from({ length: loadMoreSkeletonCount }, (_, index) => (
                  <div key={`more-skeleton-${index}`} className="shop-product-grid__cell min-w-0">
                    <ProductCardSkeleton />
                  </div>
                ))
              : null}
          </motion.div>
        ) : (
          <div
            key={gridFilterKey}
            className={cn(
              'shop-product-grid',
              !isHomepage && 'shop-product-grid--soft-enter',
              isHomepage && 'shop-product-grid--homepage',
              !isHomepage && gridDensity === 1 && 'shop-product-grid--cols-1',
              !isHomepage && gridDensity === 2 && 'shop-product-grid--cols-2',
            )}
          >
            {visibleProducts.map((product, index) => {
              const card = storefrontToCardData(product)
              const cardCode = resolveCardProductCode(product)

              return (
                <div key={product.id} className="shop-product-grid__cell min-w-0">
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
                    {...(card.images.length > 2 ? { galleryImages: card.images } : {})}
                    {...(cardCode ? { productCode: cardCode } : {})}
                    colorHexes={product.colors}
                    status={product.status}
                    inStock={product.inStock ?? isStorefrontProductInStock(product)}
                    sizes={product.sizes}
                    href={getProductHref(product)}
                    priority={index < priorityCount}
                    onAddToBag={() =>
                      addProductToBag(product, product.sizes[0], product.colors[0], true)
                    }
                    onShowDetails={() => setQuickViewProduct(product)}
                  />
                </div>
              )
            })}
            {loadingMore
              ? Array.from({ length: loadMoreSkeletonCount }, (_, index) => (
                  <div key={`more-skeleton-${index}`} className="shop-product-grid__cell min-w-0">
                    <ProductCardSkeleton />
                  </div>
                ))
              : null}
          </div>
        )}

        {quickViewProduct ? (
          <ProductQuickView
            product={buildQuickViewProduct(quickViewProduct)}
            open
            onClose={() => setQuickViewProduct(null)}
            onAddToBag={(size, color) => {
              addProductToBag(quickViewProduct, size, color, true)
            }}
          />
        ) : null}

        <AnimatePresence initial={false}>
          {!isHomepage && filteredProducts.length > 0 ? (
            <motion.p
              key="results-footer"
              className="shop-results-footer"
              aria-live="polite"
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: GRID_EASE }}
            >
              1 – {visibleProducts.length} of {filteredProducts.length} Item
              {filteredProducts.length === 1 ? '' : 's'}
            </motion.p>
          ) : null}
        </AnimatePresence>

        {canLoadMore ? (
          animateGrid ? (
            <motion.div
              className="shop-load-more-wrap mt-8"
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: GRID_EASE }}
            >
              <motion.button
                type="button"
                className="shop-load-more-btn"
                disabled={loadingMore}
                onClick={() => void handleLoadMore()}
                whileTap={{ opacity: 0.96 }}
                whileHover={{ borderColor: 'rgba(16, 17, 20, 0.55)' }}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </motion.button>
            </motion.div>
          ) : (
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
          )
        ) : null}

        {!showProductSkeleton &&
        filteredProducts.length === 0 &&
        catalogSource !== 'api-unavailable' ? (
          <div className="shop-empty glass-tile">
            {catalogIsEmpty && !hasActiveFilters ? (
              <>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-black/40">
                  Catalog coming soon
                </p>
                <h2 className="mt-3 text-2xl font-black tracking-normal text-black">
                  New pieces are on the way.
                </h2>
                <p className="mt-2 max-w-md text-sm text-black/55">
                  Our collection is being prepared. Check back soon or contact us for help.
                </p>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        ) : null}
      </section>
    </>
  )
}
