'use client'

/** Product detail client — purchase flow + gallery (no PDP wishlist). */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent, type SVGProps } from 'react'
import { StorefrontImage } from '@/components/ui/StorefrontImage'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from '@/lib/motion/react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Layers,
  MapPin,
  Maximize2,
  Minus,
  Package,
  Plus,
  Ruler,
  Shirt,
  Sparkles,
  Star,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { subscribeScroll } from '@/hooks/useScrollY'
import { snapDocumentScrollToTop } from '@/lib/navigation/snap-scroll-top'
import { AddToBagIcon } from '@/components/product/AddToBagIcon'
import { MotionAnchor, MotionPressable } from '@/components/ui/MotionPressable'
import { MotionSwapLabel } from '@/components/ui/MotionSwapLabel/MotionSwapLabel'
import {
  ProductFadeSwap,
  ProductReveal,
  ProductStagger,
  PRODUCT_GALLERY_MS,
  productGalleryEase,
  productShake,
} from '@/components/product/ProductMotion'
import { trackRecentlyViewed } from '@/lib/recentlyViewed'
import { collectionHref } from '@/lib/storefront/collection-paths'
import { useCartStore, type CartItem } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { getCheckoutEntryPath } from '@/lib/checkout/checkout-auth'
import { safeClientNavigate } from '@/lib/navigation/safe-client-navigate'
import { stageCheckoutItems } from '@/lib/cart/checkout-intent'
import { useUiStore } from '@/store/uiStore'
import { cn } from '@/lib/utils/cn'
import { formatBDT } from '@/lib/utils/currency'
import { ProductPrice } from '@/components/product/ProductPrice'
import { PdpShippingStory } from '@/components/product/PdpShippingStory'
import { PdpCareStory, splitCareInstructionLines } from '@/components/product/PdpCareStory'
import { trackAddToCart, trackViewContent } from '@/lib/analytics/meta-pixel'
import type { ProductDetailData } from '@/types/product'
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import { sanitizeRemoteImageUrl } from '@/lib/assets/images'
import { sanitizeStorefrontProductCode } from '@/lib/catalog/storefront-sanitize'
import { buildProductDescriptionBn } from '@/lib/catalog/product-copy-bn'
import { optimizeImageSrc } from '@/lib/assets/image-optimize'
import type { ProductReview } from '@/lib/catalog/live'
import { sortSizes } from '@/lib/catalog/live'
import { resolveDetailsCategoryIcon } from '@/lib/catalog/details-category-icon'
import { resolveSizeOptionUi } from '@/lib/catalog/size-option-ui'
import { resolveStockStatus } from '@/lib/catalog/stock-status'
import { ProductReviews } from '@/components/product/ProductReviews/ProductReviews'
import { PDP_REVIEWS_VISIBLE } from '@/lib/catalog/pdp-reviews-visibility'
import { ProductLightbox } from '@/components/product/ProductLightbox/ProductLightbox'
import { ProductPurchaseExtras } from '@/components/product/ProductPurchaseExtras/ProductPurchaseExtras'
import { ProductPurchaseSticky } from '@/components/product/ProductPurchaseSticky/ProductPurchaseSticky'
import { SizeGuideModal } from '@/components/product/SizeGuideModal/SizeGuideModal'
import { HorizontalScrollRail } from '@/components/ui/HorizontalScrollRail'
import { productMediaTransitionStyle } from '@/lib/navigation/view-transition'
import { useMotionReady } from '@/hooks/useMotionReady'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import toast from 'react-hot-toast'

interface ProductPageClientProps {
  product: ProductDetailData
  reviews?: ProductReview[]
}

const PANEL_EASE = [0.22, 1, 0.36, 1] as const
/** Liquid size bubble — controlled spring (tiny settle, no cartoon bounce). */
const SIZE_LIQUID_SPRING = { type: 'spring' as const, stiffness: 460, damping: 34, mass: 0.72 }
const PANEL_MS = 0.3

function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M14.1 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.3-1.5 1.6-1.5h1.7V4.6c-.8-.1-1.6-.2-2.4-.2-2.5 0-4.2 1.5-4.2 4.3v2.2H8v3.1h2.8v8h3.3Z"
      />
    </svg>
  )
}

function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M12.1 3.2a8.7 8.7 0 0 0-7.4 13.3L3.8 21l4.6-1.2a8.7 8.7 0 1 0 3.7-16.6Zm0 15.7a7 7 0 0 1-3.6-1l-.3-.2-2.7.7.7-2.6-.2-.3a7 7 0 1 1 6.1 3.4Zm3.9-5.2c-.2-.1-1.3-.7-1.5-.7-.2-.1-.4-.1-.5.1l-.7.8c-.1.2-.3.2-.5.1a5.7 5.7 0 0 1-2.8-2.4c-.2-.3 0-.4.1-.6l.4-.4.2-.4c.1-.1 0-.3 0-.4l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.9 2.3 1 2.5a8 8 0 0 0 3.1 2.8c1.2.5 1.7.6 2.3.5.4-.1 1.3-.5 1.5-1 .2-.5.2-.9.1-1-.1-.1-.2-.1-.5-.2Z"
      />
    </svg>
  )
}

function XSocialIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M17.7 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.2L5.3 21H2.2l7.2-8.3L1.8 3h6.5l4.4 5.7L17.7 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11 14.5Z"
      />
    </svg>
  )
}

function MessengerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M12 2.2C6.4 2.2 2 6.3 2 11.6c0 2.9 1.3 5.5 3.5 7.2v3l3.2-1.8c.9.2 1.8.4 2.3.4 5.6 0 10-4.1 10-9.4S17.6 2.2 12 2.2Zm1 12.6-2.6-2.7-5 2.7 5.5-5.8 2.6 2.7 5-2.7-5.5 5.8Z"
      />
    </svg>
  )
}

const DETAIL_SECTION_SUMMARY: Record<string, string> = {
  Details: 'Fabric, fit & finish',
  Shipping: 'Delivery & returns',
  Care: 'Keep it looking new',
}
const DETAIL_SECTION_SUMMARY_FALLBACK = 'Product information'

/** Reader's description language, shared across every product page. */
const DESC_LANG_KEY = 'splaro:pdp-desc-lang'

function renderFormattedDescription(text: string) {
  if (!text) return null
  const bulletItems = text
    .split(/\n+|•|\b(?<=\.\s)/)
    .map((s) => s.trim().replace(/^[-•*]\s*/, ''))
    .filter((s) => s.length > 2)

  if (bulletItems.length > 1) {
    return (
      <ul className="pp-desc-bullets">
        {bulletItems.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2.5 text-base text-stone-800 leading-relaxed font-normal my-1">
            <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-800" aria-hidden />
            <span className="flex-1">{item}</span>
          </li>
        ))}
      </ul>
    )
  }

  return <p className="text-base text-stone-800 leading-relaxed font-normal">{text}</p>
}

export default function ProductPageClient({
  product,
  reviews = [],
}: ProductPageClientProps) {
  const router = useRouter()
  const reducedMotion = useReducedMotion()
  const { showMotion } = useMotionReady()
  const galleryAnimated = showMotion && !reducedMotion
  const user = useAuthStore((state) => state.user)
  const authHydrated = useAuthStore((state) => state._hydrated)
  const { addItem } = useCartStore()
  const setCartOpen = useUiStore((state) => state.setCartOpen)

  const [activeImage, setActiveImage] = useState(0)
  const swipeRef = useRef<{ x: number; y: number; moved: boolean; axis?: 'x' | 'y' } | null>(null)
  const swipeConsumedUntilRef = useRef(0)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [addedPulse, setAddedPulse] = useState(false)
  const [addingToCart, setAddingToCart] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [descLang, setDescLang] = useState<'en' | 'bn'>('en')
  const [openSection, setOpenSection] = useState<string | null>(null)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false)
  const [sizeShake, setSizeShake] = useState(false)
  const sizeRowRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  const galleryStageRef = useRef<HTMLDivElement>(null)
  const [showFloatingCta, setShowFloatingCta] = useState(false)
  const { shipping } = useStorefrontSettings()

  // Product open must never inherit shop scrollY (footer landing).
  useLayoutEffect(() => {
    snapDocumentScrollToTop()
    const raf = requestAnimationFrame(() => {
      snapDocumentScrollToTop()
      requestAnimationFrame(snapDocumentScrollToTop)
    })
    const timers = [50, 150, 300, 600, 1000].map((delay) =>
      window.setTimeout(snapDocumentScrollToTop, delay),
    )
    return () => {
      cancelAnimationFrame(raf)
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [product.id])

  const fullDescription = product.description?.trim() ?? ''
  const shortDesc =
    product.shortDescription?.trim() ||
    (fullDescription.length > 160 ? fullDescription : fullDescription)
  /** Clamp visually when copy is long; full text always stays in the DOM for crawlers. */
  const showReadMore = fullDescription.length > 160

  /**
   * Admin-written Bangla wins. Without it, Bangla is generated from the
   * merchant spec fields — and when there are none, this stays empty and the
   * language toggle never renders.
   */
  const descriptionBn = useMemo(
    () =>
      product.descriptionBn?.trim() ||
      buildProductDescriptionBn({
        name: product.name,
        nameBn: product.nameBn,
        fabricContent: product.fabricContent,
        fitType: product.fitType,
        occasion: product.occasion,
      }),
    [
      product.descriptionBn,
      product.name,
      product.nameBn,
      product.fabricContent,
      product.fitType,
      product.occasion,
    ],
  )

  /**
   * Restore the reader's language after mount rather than during render —
   * the server has no localStorage, and reading it inline would desync
   * hydration.
   */
  useEffect(() => {
    try {
      if (window.localStorage.getItem(DESC_LANG_KEY) === 'bn') setDescLang('bn')
    } catch {
      // Private mode / storage disabled — English stays.
    }
  }, [])

  const chooseDescLang = (next: 'en' | 'bn') => {
    setDescLang(next)
    setDescExpanded(false)
    try {
      window.localStorage.setItem(DESC_LANG_KEY, next)
    } catch {
      // Preference simply won't persist.
    }
  }

  const showBangla = descLang === 'bn' && descriptionBn.length > 0

  const colorOptions = useMemo(() => {
    const map = new Map<string, { hex: string; name: string; image: string }>()

    product.variants.forEach((v) => {
      if (!v.colorHex) return
      const hex = v.colorHex.toLowerCase()
      if (!map.has(hex)) {
        map.set(hex, {
          hex,
          name: v.colorName ?? v.color ?? 'Selected',
          image: v.image ? sanitizeRemoteImageUrl(v.image) : '',
        })
      }
    })

    if (product.colorOptions?.length && map.size === 0) {
      product.colorOptions.forEach((opt, index) => {
        map.set(opt.hex.toLowerCase(), {
          hex: opt.hex.toLowerCase(),
          name: opt.name,
          image: sanitizeRemoteImageUrl(product.images[index] ?? product.images[0] ?? ''),
        })
      })
    }

    const options = [...map.values()]
    if (options.length > 1 && product.images.length > 1) {
      const uniqueImages = new Set(options.map((o) => o.image).filter(Boolean))
      if (uniqueImages.size <= 1) {
        return options.map((opt, index) => ({
          ...opt,
          image:
            sanitizeRemoteImageUrl(product.images[index] ?? product.images[0] ?? '') ||
            opt.image ||
            PRODUCT_IMAGE_PLACEHOLDER,
        }))
      }
    }

    return options.map((opt) => ({
      ...opt,
      image: opt.image || sanitizeRemoteImageUrl(product.images[0] ?? '') || PRODUCT_IMAGE_PLACEHOLDER,
    }))
  }, [product.colorOptions, product.images, product.variants])

  const colors = useMemo(
    () => colorOptions.map((opt) => [opt.hex, opt.name] as [string, string]),
    [colorOptions],
  )

  const activeColorOption = useMemo(
    () => colorOptions.find((opt) => opt.hex === selectedColor) ?? colorOptions[0],
    [colorOptions, selectedColor],
  )

  const colorMediaMap = useMemo(() => {
    const map = new Map<string, string[]>()
    product.variants.forEach((v) => {
      if (!v.colorHex) return
      const hex = v.colorHex.toLowerCase()
      const list = map.get(hex) ?? []
      const img = v.image ? sanitizeRemoteImageUrl(v.image) : ''
      if (img && !list.includes(img)) list.push(img)
      map.set(hex, list)
    })
    colorOptions.forEach((opt) => {
      const list = map.get(opt.hex) ?? []
      if (opt.image && !list.includes(opt.image)) list.unshift(opt.image)
      map.set(opt.hex, list.length ? list : [opt.image])
    })
    return map
  }, [colorOptions, product.variants])

  const media = useMemo(() => {
    const normalizeImageUrl = (url: string) =>
      sanitizeRemoteImageUrl(url) || PRODUCT_IMAGE_PLACEHOLDER

    const baseGallery = product.media?.length
      ? product.media
          .map((item) => ({
            type: item.type,
            url: item.type === 'image' ? normalizeImageUrl(item.url) : item.url,
          }))
          .filter((item) => Boolean(item.url))
      : product.images
          .map((url) => ({ type: 'image' as const, url: normalizeImageUrl(url) }))
          .filter((item) => Boolean(item.url))

    const hex = selectedColor?.toLowerCase()
    const colorUrls = (hex ? colorMediaMap.get(hex)?.filter(Boolean) : undefined) ?? []

    // Colour selected → lead gallery with that colour’s image(s), then other media.
    // (Previously skipped when only 1 colour image + multi gallery — main photo never changed.)
    if (colorUrls.length > 0) {
      const colorItems = colorUrls.map((url) => ({ type: 'image' as const, url }))
      const extras = baseGallery.filter(
        (item) => item.type !== 'image' || !colorUrls.includes(item.url),
      )
      return [...colorItems, ...extras]
    }

    return baseGallery.length > 0
      ? baseGallery
      : [{ type: 'image' as const, url: PRODUCT_IMAGE_PLACEHOLDER }]
  }, [colorMediaMap, product.images, product.media, selectedColor])

  const sizes = useMemo(() => {
    const unique = new Set(product.variants.map((v) => v.size).filter(Boolean))
    return sortSizes(Array.from(unique) as string[], product.category)
  }, [product.variants, product.category])

  const sizeOptionUi = useMemo(
    () =>
      resolveSizeOptionUi({
        sizes,
        category: product.category,
        categorySlug: product.categorySlug,
      }),
    [sizes, product.category, product.categorySlug],
  )

  const showColorPicker = colorOptions.length > 1

  const displayProductCode = sanitizeStorefrontProductCode(product.sku, product.slug)

  const sizeStock = useMemo(() => {
    const map = new Map<string, number>()
    product.variants.forEach((v) => {
      if (!v.size) return
      if (selectedColor && v.colorHex?.toLowerCase() !== selectedColor.toLowerCase()) return
      map.set(v.size, (map.get(v.size) ?? 0) + v.stock)
    })
    return map
  }, [product.variants, selectedColor])

  const activeVariant = useMemo(() => {
    return product.variants.find(
      (v) =>
        (!selectedSize || v.size === selectedSize) &&
        (!selectedColor || v.colorHex?.toLowerCase() === selectedColor.toLowerCase()),
    )
  }, [product.variants, selectedSize, selectedColor])

  const selectedColorName =
    colors.find(([hex]) => hex.toLowerCase() === (selectedColor ?? '').toLowerCase())?.[1] ??
    activeColorOption?.name ??
    '—'

  const productHasStock = product.variants.some(
    (v) => v.isActive !== false && v.stock > 0,
  )
  const allowOversell =
    product.inventoryPolicy === 'CONTINUE' || product.inventoryPolicy === 'PREORDER'
  const stock = activeVariant?.stock ?? 0
  const selectionInStock = stock > 0
  const sellableProduct = productHasStock || allowOversell
  const sellableSelection = selectionInStock || allowOversell
  const inStock = sellableSelection
  const lowStock = inStock && stock > 0 && stock <= 5 && product.inventoryPolicy !== 'PREORDER'
  // Per-size pill: only after a size is chosen (never show colour-total before select).
  const selectedSizeUnits = selectedSize ? (sizeStock.get(selectedSize) ?? 0) : null
  const sizeStockStatus =
    selectedSizeUnits == null
      ? null
      : resolveStockStatus(selectedSizeUnits, {
          preorder: product.inventoryPolicy === 'PREORDER',
        })
  const unitPrice = activeVariant?.price ?? product.price
  const compareAtPrice = activeVariant?.compareAtPrice ?? product.compareAtPrice

  const [shareUrl, setShareUrl] = useState('')
  const [ctaShake, setCtaShake] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShareUrl(window.location.href)
    }
  }, [product.slug])

  useEffect(() => {
    if (typeof window === 'undefined') return

    let attachedEl: HTMLElement | null = null
    let io: IntersectionObserver | null = null
    let boundaryIo: IntersectionObserver | null = null
    let unsubScroll: (() => void) | null = null
    let raf = 0
    let alive = true
    let attachTries = 0
    let relatedAttachTries = 0

    const resolveCta = () =>
      ctaRef.current ?? (document.querySelector('.pp-info__ctas') as HTMLElement | null)

    const updateFloatingCta = () => {
      const el = resolveCta()
      if (!el) {
        setShowFloatingCta(false)
        return
      }
      const rect = el.getBoundingClientRect()
      if (rect.height <= 0 && rect.width <= 0) {
        setShowFloatingCta(false)
        return
      }

      // Never sit on top of the footer (footer markup locked — hide sticky instead).
      const footer = document.querySelector('footer.site-footer, footer[data-site-chrome]')
      if (footer) {
        const footerTop = footer.getBoundingClientRect().top
        if (footerTop < window.innerHeight - 12) {
          setShowFloatingCta((prev) => (prev ? false : prev))
          return
        }
      }

      // Hide before "You may also like" — related is a sibling after ProductPageClient.
      const related = document.querySelector('.pp-related')
      if (related) {
        const relatedTop = related.getBoundingClientRect().top
        if (relatedTop < window.innerHeight - 24) {
          setShowFloatingCta((prev) => (prev ? false : prev))
          return
        }
      }

      // Require scroll intent before floating — the bar used to be prominent
      // on first paint (inline CTA below the fold on mobile) and crammed the
      // page together with the bottom nav + chat bubble.
      //
      // "Visible" has to mean *usable*, though. On a 390×844 phone the inline
      // CTA starts at 832px: its top edge clears the old test while 40 of its
      // 52px sit under the fold, so the bar stayed hidden behind a button
      // nobody could press. Require the whole control to be in view, and drop
      // the scroll gate to the first real flick so intent still comes first
      // without making the shopper hunt for the buy button.
      const topInset = 72
      // The mobile tab bar is fixed at z-120 over the page. A CTA sitting
      // under it is not reachable however "visible" its coordinates look, so
      // the bottom inset has to be the bar's real height, not a token gap.
      const navBar = document.querySelector('.mobile-bottom-nav')
      const bottomInset =
        navBar && navBar.getBoundingClientRect().height > 0
          ? navBar.getBoundingClientRect().height + 12
          : 28
      const fullyVisible =
        rect.top > topInset && rect.bottom < window.innerHeight - bottomInset
      const hasScrolled = window.scrollY > 40
      const next = !fullyVisible && hasScrolled
      setShowFloatingCta((prev) => (prev === next ? prev : next))
    }

    const observeBoundaries = () => {
      if (typeof IntersectionObserver === 'undefined') return

      boundaryIo?.disconnect()
      boundaryIo = new IntersectionObserver(updateFloatingCta, {
        threshold: [0, 0.01, 0.1],
      })

      const footer = document.querySelector('footer.site-footer, footer[data-site-chrome]')
      if (footer) boundaryIo.observe(footer)

      const related = document.querySelector('.pp-related')
      if (related) {
        boundaryIo.observe(related)
        return true
      }
      return false
    }

    const attach = () => {
      const el = resolveCta()
      if (!el || !alive) return false
      if (attachedEl === el && io) {
        updateFloatingCta()
        observeBoundaries()
        return true
      }

      io?.disconnect()
      attachedEl = el
      updateFloatingCta()

      if (typeof IntersectionObserver !== 'undefined') {
        io = new IntersectionObserver(updateFloatingCta, {
          threshold: [0, 0.05, 0.15, 0.35, 0.6, 1],
          rootMargin: '-72px 0px -28px 0px',
        })
        io.observe(el)
        observeBoundaries()
      }
      return true
    }

    // Retry attach a few times if ProductReveal delays the CTA — no permanent poll.
    const tryAttach = () => {
      if (attach() || !alive) return
      attachTries += 1
      if (attachTries < 12) {
        raf = window.requestAnimationFrame(tryAttach)
      }
    }
    tryAttach()

    // Related products load in Suspense after the PDP client — retry observe briefly.
    let relatedTimer = 0
    const tryRelated = () => {
      if (!alive) return
      if (observeBoundaries()) return
      relatedAttachTries += 1
      if (relatedAttachTries < 40) {
        relatedTimer = window.setTimeout(tryRelated, 120)
      }
    }
    tryRelated()

    unsubScroll = subscribeScroll(updateFloatingCta)
    window.addEventListener('resize', updateFloatingCta, { passive: true })

    return () => {
      alive = false
      window.cancelAnimationFrame(raf)
      window.clearTimeout(relatedTimer)
      io?.disconnect()
      boundaryIo?.disconnect()
      unsubScroll?.()
      window.removeEventListener('resize', updateFloatingCta)
    }
  }, [product.id])

  // Mobile sticky purchase bar sits above the floating chat/back-to-top —
  // flag it so those widgets lift clear instead of covering Buy Now.
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return
    if (showFloatingCta) {
      document.body.setAttribute('data-pdp-sticky-cta', 'true')
    } else {
      document.body.removeAttribute('data-pdp-sticky-cta')
    }
    return () => {
      document.body.removeAttribute('data-pdp-sticky-cta')
    }
  }, [showFloatingCta])

  useEffect(() => {
    trackRecentlyViewed(product.id)
    trackViewContent({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      brand: 'SPLARO',
      ...(product.category ? { category: product.category } : {}),
      ...(product.categorySlug && product.categorySlug !== product.category
        ? { category2: product.categorySlug }
        : {}),
    })
    // Deliberately unselected by default. Pre-picking the smallest size makes a
    // decision the shopper has to notice and undo. Merchant/Meta deep-links (?v=)
    // are the exception — apply after defaults so feed landing pages preselect.
    setSelectedSize(null)
    setSelectedColor(colorOptions[0]?.hex ?? null)
    setActiveImage(0)
    setQuantity(1)
    setDescExpanded(false)
    setOpenSection(null)

    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const deepVariantId = params.get('v')?.trim()
    const deepSize = params.get('size')?.trim()
    const deepColor = params.get('color')?.trim()?.toLowerCase()

    if (deepVariantId) {
      const match = product.variants.find((v) => v.id === deepVariantId)
      if (match) {
        if (match.size) setSelectedSize(match.size)
        if (match.colorHex) setSelectedColor(match.colorHex.toLowerCase())
        return
      }
    }
    if (deepSize && sizes.includes(deepSize)) {
      setSelectedSize(deepSize)
    }
    if (deepColor) {
      const byHex = colorOptions.find((o) => o.hex.toLowerCase() === deepColor)
      const byName = colorOptions.find((o) => o.name.toLowerCase() === deepColor)
      const next = byHex ?? byName
      if (next) setSelectedColor(next.hex)
    }
  }, [
    product.id,
    product.name,
    product.price,
    product.category,
    product.categorySlug,
    product.variants,
    sizes,
    colorOptions,
  ])

  useEffect(() => {
    setActiveImage(0)
    if (selectedColor && selectedSize && (sizeStock.get(selectedSize) ?? 0) === 0) {
      const next = sizes.find((size) => (sizeStock.get(size) ?? 0) > 0)
      if (next) setSelectedSize(next)
    }
  }, [selectedColor, selectedSize, sizeStock, sizes])

  // Warm thumb cache only — full-res gallery images are already rendered by
  // <StorefrontImage> (priority on slide 0, lazy on the rest) via next/image.
  // A manual full-res prefetch here bypassed the Next image optimizer and
  // double-fetched every gallery photo (raw Unsplash URL + optimized URL).
  useEffect(() => {
    if (typeof window === 'undefined' || !media.length) return

    for (const item of media) {
      if (item?.type !== 'image' || !item.url) continue
      const thumb = new window.Image()
      thumb.decoding = 'async'
      thumb.src = optimizeImageSrc(item.url, 'thumb')
    }
  }, [media])

  useEffect(() => {
    // Warm checkout RSC + JS so Buy Now is instant.
    router.prefetch(getCheckoutEntryPath())
  }, [router])

  useEffect(() => {
    setQuantity((q) => Math.min(Math.max(1, q), Math.max(1, stock)))
  }, [stock])

  const detailSections = useMemo(() => {
    type DetailLine = { icon: LucideIcon; text: string }
    type DetailSection = { id: string; icon: LucideIcon; lines: DetailLine[] }

    const sections: DetailSection[] = []

    // Specs only — lead description stays above (no double paste).
    const detailLines: DetailLine[] = []
    if (product.fabricContent?.trim()) {
      detailLines.push({ icon: Layers, text: `Materials · ${product.fabricContent.trim()}` })
    }
    if (product.weavingType?.trim()) {
      detailLines.push({ icon: Sparkles, text: `Weaving · ${product.weavingType.trim()}` })
    }
    const isAccessory = /accessor|bag|wallet|watch|scarf|belt|tote|crossbody/i.test(
      `${product.category ?? ''} ${product.categorySlug ?? ''} ${product.name}`,
    )
    const fit = product.fitType?.trim()
    if (fit) {
      const fitLabel = isAccessory ? 'Carry' : 'Fit'
      const fitValue =
        isAccessory || /\bfit\b/i.test(fit) ? fit : `${fit} fit`
      detailLines.push({ icon: Shirt, text: `${fitLabel} · ${fitValue}` })
    }
    for (const spec of product.specs ?? []) {
      if (!spec.label?.trim() || !spec.value?.trim()) continue
      // Weight may also come from weightGrams → already in specs via live map.
      detailLines.push({
        icon: Ruler,
        text: `${spec.label.trim()} · ${spec.value.trim()}`,
      })
    }
    if (product.occasion?.trim()) {
      detailLines.push({ icon: Shirt, text: `Occasion · ${product.occasion.trim()}` })
    }
    if (product.season?.trim()) {
      detailLines.push({ icon: Sparkles, text: `Season · ${product.season.trim()}` })
    }
    if (detailLines.length > 0) {
      sections.push({
        id: 'Details',
        icon: resolveDetailsCategoryIcon(product.category, product.categorySlug),
        lines: detailLines,
      })
    }

    const shippingLines: DetailLine[] = [
      {
        icon: MapPin,
        text: `Dhaka ${formatBDT(Math.round(shipping.dhakaDeliveryCharge))} · Outside ${formatBDT(Math.round(shipping.outsideDhakaCharge))}`,
      },
    ]
    if (shipping.freeDeliveryThreshold > 0) {
      shippingLines.push({
        icon: Package,
        text: `Free delivery over ${formatBDT(Math.round(shipping.freeDeliveryThreshold))}`,
      })
    }
    shippingLines.push({
      icon: Clock3,
      text: 'Most orders arrive within 2–4 business days',
    })
    shippingLines.push({
      icon: MapPin,
      text: `Origin · ${(product.origin ?? 'Bangladesh').trim() || 'Bangladesh'}`,
    })
    sections.push({ id: 'Shipping', icon: Truck, lines: shippingLines })

    const careLines: DetailLine[] = []
    if (product.careInstructions?.trim()) {
      careLines.push(
        ...splitCareInstructionLines(product.careInstructions).map((line) => ({
          icon: line.icon,
          text: line.text,
        })),
      )
    }
    if (careLines.length > 0) {
      sections.push({ id: 'Care', icon: Sparkles, lines: careLines })
    }

    return sections
  }, [
    product.careInstructions,
    product.category,
    product.categorySlug,
    product.fabricContent,
    product.weavingType,
    product.fitType,
    product.name,
    product.occasion,
    product.origin,
    product.season,
    product.specs,
    shipping.dhakaDeliveryCharge,
    shipping.outsideDhakaCharge,
    shipping.freeDeliveryThreshold,
  ])

  const buildSelectedCartItem = (): CartItem | null => {
    if (!sellableProduct || !sellableSelection) return null
    // Synthetic variant ids (product.id or `${product.id}-…`) are UI-only —
    // the API rejects them, so only send ids that came from the database.
    const realVariantId =
      activeVariant?.id &&
      !activeVariant.id.startsWith('unavailable:') &&
      activeVariant.id !== product.id &&
      !activeVariant.id.startsWith(`${product.id}-`)
        ? activeVariant.id
        : undefined
    const item: CartItem = {
      productId: product.id,
      ...(realVariantId ? { variantId: realVariantId } : {}),
      quantity,
      name: product.name,
      price: unitPrice,
      image: activeVariant?.image ?? activeColorOption?.image ?? product.images[0] ?? '',
      slug: product.slug,
    }
    if (selectedSize) item.size = selectedSize
    if (selectedColor) {
      item.color = selectedColorName !== '—' ? selectedColorName : selectedColor
    }
    return item
  }

  const addSelectedItemToCart = () => {
    const item = buildSelectedCartItem()
    if (!item) return false
    addItem(item)
    trackAddToCart({
      id: item.variantId ?? item.productId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      brand: 'SPLARO',
      ...(product.category ? { category: product.category } : {}),
      ...(item.size || item.color
        ? { variant: [item.size, item.color].filter(Boolean).join(' / ') }
        : {}),
    })
    return true
  }

  /** Instant offset scroll — smooth scrollIntoView causes mid-click jump/miss on Windows. */
  const scrollElIntoView = (el: HTMLElement | null) => {
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - 96
    window.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
  }

  const validatePurchaseSelection = (): boolean => {
    if (!sellableProduct) {
      setCtaShake(true)
      window.setTimeout(() => setCtaShake(false), 480)
      toast.error('This product is out of stock')
      return false
    }
    if (!sellableSelection) {
      setCtaShake(true)
      scrollElIntoView(optionsRef.current)
      toast.error(
        sizeOptionUi.showSelector
          ? 'This size or colour is out of stock — try another'
          : 'This colour is out of stock — try another',
      )
      window.setTimeout(() => setCtaShake(false), 480)
      return false
    }
    if (sizes.length > 0 && sizeOptionUi.showSelector) {
      if (!selectedSize) {
        setSizeShake(true)
        scrollElIntoView(sizeRowRef.current)
        toast.error(sizeOptionUi.selectToast)
        window.setTimeout(() => setSizeShake(false), 520)
        return false
      }
      if ((sizeStock.get(selectedSize) ?? 0) === 0 && !allowOversell) {
        setSizeShake(true)
        scrollElIntoView(sizeRowRef.current)
        toast.error('Selected option is out of stock')
        window.setTimeout(() => setSizeShake(false), 520)
        return false
      }
    }
    if (showColorPicker && !selectedColor) {
      scrollElIntoView(optionsRef.current)
      toast.error('Please select a colour')
      return false
    }
    return true
  }

  const handleAddToCart = () => {
    if (addingToCart) return
    if (isLightboxOpen) closeLightbox()
    if (!validatePurchaseSelection()) return
    setAddingToCart(true)
    if (!addSelectedItemToCart()) {
      setAddingToCart(false)
      setCtaShake(true)
      window.setTimeout(() => setCtaShake(false), 480)
      return
    }
    setAddedPulse(true)
    window.setTimeout(() => setCartOpen(true), 420)
    window.setTimeout(() => {
      setAddingToCart(false)
      setAddedPulse(false)
    }, 1400)
  }

  const handleBuyNow = () => {
    if (isLightboxOpen) closeLightbox()
    if (!validatePurchaseSelection()) return
    const item = buildSelectedCartItem()
    if (!item) return
    // Merge into cart — never wipe existing lines (Buy Now used to replaceItems).
    addItem(item)
    stageCheckoutItems(useCartStore.getState().items)
    // Navigate first — never block on auth hydrate or analytics.
    const checkoutPath = getCheckoutEntryPath()
    router.prefetch(checkoutPath)
    safeClientNavigate(router, checkoutPath)
    trackAddToCart({
      id: item.variantId ?? item.productId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      brand: 'SPLARO',
      ...(product.category ? { category: product.category } : {}),
      ...(item.size || item.color
        ? { variant: [item.size, item.color].filter(Boolean).join(' / ') }
        : {}),
    })
  }

  const prevImage = () => {
    setActiveImage((i) => (i - 1 + media.length) % media.length)
  }
  const nextImage = () => {
    setActiveImage((i) => (i + 1) % media.length)
  }
  const openLightbox = () => {
    setIsLightboxOpen(true)
  }
  const closeLightbox = () => {
    setIsLightboxOpen(false)
  }
  const openGalleryZoom = () => {
    if (media[activeImage]?.type === 'video') return
    if (Date.now() < swipeConsumedUntilRef.current) return
    if (swipeRef.current?.moved) return
    // Tap cycles photos; expand button / double-click opens fullscreen zoom
    if (media.length > 1) {
      nextImage()
      return
    }
    openLightbox()
  }

  const beginGallerySwipe = (x: number, y: number) => {
    if (media[activeImage]?.type === 'video' || media.length < 2) return
    swipeRef.current = { x, y, moved: false }
  }

  const trackGallerySwipe = (x: number, y: number) => {
    const start = swipeRef.current
    if (!start) return
    const dx = x - start.x
    const dy = y - start.y
    if (!start.axis && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      start.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
    }
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) start.moved = true
  }

  const endGallerySwipe = (x: number, y: number) => {
    const start = swipeRef.current
    if (!start) return
    const dx = x - start.x
    const dy = y - start.y
    const threshold = 32
    const horizontal =
      start.axis !== 'y' &&
      start.moved &&
      Math.abs(dx) >= threshold &&
      Math.abs(dx) > Math.abs(dy) * 1.05
    swipeRef.current = null
    if (!horizontal) return
    swipeConsumedUntilRef.current = Date.now() + 350
    if (dx < 0) nextImage()
    else prevImage()
  }

  const onGalleryPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    beginGallerySwipe(event.clientX, event.clientY)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* older browsers */
    }
  }

  const onGalleryPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    trackGallerySwipe(event.clientX, event.clientY)
  }

  const onGalleryPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    endGallerySwipe(event.clientX, event.clientY)
  }

  const onGalleryPointerCancel = () => {
    swipeRef.current = null
  }

  const onGalleryTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    if (!touch) return
    beginGallerySwipe(touch.clientX, touch.clientY)
  }

  const onGalleryTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    const start = swipeRef.current
    if (!touch || !start) return
    trackGallerySwipe(touch.clientX, touch.clientY)
  }

  const onGalleryTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0]
    if (!touch) {
      swipeRef.current = null
      return
    }
    endGallerySwipe(touch.clientX, touch.clientY)
  }

  // Native non-passive touchmove — only lock when swipe axis is horizontal.
  useEffect(() => {
    const el = galleryStageRef.current
    if (!el) return
    const onMove = (event: TouchEvent) => {
      const start = swipeRef.current
      const touch = event.touches[0]
      if (!start || !touch) return
      trackGallerySwipe(touch.clientX, touch.clientY)
      if (start.axis === 'x') event.preventDefault()
    }
    el.addEventListener('touchmove', onMove, { passive: false })
    return () => el.removeEventListener('touchmove', onMove)
  }, [media.length, activeImage])

  const heroMediaTransition =
    activeImage === 0 && media[0]?.type !== 'video'
      ? productMediaTransitionStyle(product.id, reducedMotion)
      : undefined

  const renderGallerySlide = (item: (typeof media)[number], index: number) => {
    if (item.type === 'video') {
      return (
        <video
          src={item.url}
          className="pp-gallery__video"
          autoPlay
          muted
          loop
          playsInline
          controls
        />
      )
    }

    return (
      <div
        className="product-shared-media"
        style={index === 0 ? heroMediaTransition : undefined}
      >
        <StorefrontImage
          src={item.url}
          alt={product.name}
          profile="gallery"
          fill
          fit="cover"
          className="pp-gallery__img"
          priority={index === 0}
        />
      </div>
    )
  }

  return (
    <div className="pp-root pp-view">
      <div className="pp-wrap">
        <nav className="pp-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden>/</span>
          <Link href={collectionHref(product.collectionSlug ?? 'all')}>{product.category}</Link>
          {product.isUnisex ? (
            <>
              <span aria-hidden>/</span>
              <span className="pp-breadcrumb__audience">Unisex</span>
            </>
          ) : null}
          <span aria-hidden>/</span>
          <span aria-current="page">{product.name}</span>
        </nav>

        <div className="pp-grid">
          {/* ─── Gallery ─────────────────────────────────── */}
          <div className="pp-gallery">
            <div className="pp-gallery__main">
              <div
                ref={galleryStageRef}
                className={cn(
                  'pp-gallery__stage pp-gallery__stage--stack',
                  media[activeImage]?.type !== 'video' && 'pp-gallery__stage--zoomable',
                )}
                onPointerDown={onGalleryPointerDown}
                onPointerMove={onGalleryPointerMove}
                onPointerUp={onGalleryPointerUp}
                onPointerCancel={onGalleryPointerCancel}
                onTouchStart={onGalleryTouchStart}
                onTouchMove={onGalleryTouchMove}
                onTouchEnd={onGalleryTouchEnd}
                onTouchCancel={onGalleryPointerCancel}
                onClick={openGalleryZoom}
                onDoubleClick={(event) => {
                  event.stopPropagation()
                  openLightbox()
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openGalleryZoom()
                  }
                }}
                role={media[activeImage]?.type !== 'video' ? 'button' : undefined}
                tabIndex={media[activeImage]?.type !== 'video' ? 0 : undefined}
                aria-label={
                  media[activeImage]?.type !== 'video'
                    ? media.length > 1
                      ? 'Show next product image'
                      : 'Open product image zoom'
                    : undefined
                }
              >
                {/* Always render the same stacked structure — switching between an
                    animated stack and a bare slide on hydration remounted the hero
                    <img> and caused a blank gallery flash on first paint. */}
                {media.map((item, i) => (
                  <motion.div
                    key={`${selectedColor ?? 'default'}-${item.type}-${item.url}-${i}`}
                    className="pp-gallery__slide"
                    initial={false}
                    animate={{ opacity: i === activeImage ? 1 : 0 }}
                    transition={{
                      duration: galleryAnimated ? PRODUCT_GALLERY_MS : 0,
                      ease: productGalleryEase,
                    }}
                    style={{
                      zIndex: i === activeImage ? 2 : 1,
                    }}
                    aria-hidden={i !== activeImage}
                  >
                    {renderGallerySlide(item, i)}
                  </motion.div>
                ))}
              </div>

              <MotionPressable
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  openLightbox()
                }}
                className="pp-gallery__zoom pp-pressable"
                aria-label="Open product image fullscreen"
                variant="icon"
              >
                <Maximize2 size={17} strokeWidth={1.8} />
              </MotionPressable>

              {media.length > 1 && (
                <>
                  <MotionPressable
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      prevImage()
                    }}
                    className="pp-gallery__nav pp-gallery__nav--prev pp-pressable"
                    aria-label="Previous image"
                    variant="nav"
                  >
                    <ChevronLeft size={18} strokeWidth={1.75} />
                  </MotionPressable>
                  <MotionPressable
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      nextImage()
                    }}
                    className="pp-gallery__nav pp-gallery__nav--next pp-pressable"
                    aria-label="Next image"
                    variant="nav"
                  >
                    <ChevronRight size={18} strokeWidth={1.75} />
                  </MotionPressable>
                  <span className="sr-only" aria-live="polite">
                    Image {activeImage + 1} of {media.length}
                  </span>
                  <div className="pp-gallery__counter" aria-hidden>
                    {activeImage + 1} / {media.length}
                  </div>
                </>
              )}
            </div>

            {/* Colour thumbs choose look; arrows / stage click cycle gallery — no second thumb strip. */}
            {media.length > 1 ? (
              <div className="pp-gallery__progress" aria-hidden>
                <span className="pp-gallery__progress-label">
                  {activeImage + 1} / {media.length}
                </span>
                <span className="pp-gallery__progress-track">
                  <span
                    className="pp-gallery__progress-fill"
                    style={{
                      width: `${((activeImage + 1) / media.length) * 100}%`,
                    }}
                  />
                </span>
              </div>
            ) : null}
          </div>

          {/* ─── Product info ─────────────────────────────── */}
          <aside className="pp-info">
            <ProductStagger>
            <ProductReveal className="pp-info__header">
              <h1 className="pp-info__name">{product.name}</h1>
              {product.isUnisex ? (
                <p className="pp-info__audience" aria-label="Audience">
                  Unisex
                </p>
              ) : null}
              {product.nameBn ? (
                <p className="pp-info__name-bn" lang="bn">{product.nameBn}</p>
              ) : null}
              {product.brand ? (
                <div className="pp-info__brand">
                  <span className="pp-info__brand-label">Brand:</span>
                  {product.brand.logo ? (
                    <StorefrontImage
                      src={product.brand.logo}
                      alt={product.brand.name}
                      width={829}
                      height={241}
                      unoptimized
                      withBlur={false}
                      fit="contain"
                      className="pp-info__brand-img"
                    />
                  ) : (
                    <span className="pp-info__brand-name">{product.brand.name}</span>
                  )}
                </div>
              ) : null}
              {product.weavingType ? (
                <p className="pp-info__weave">{product.weavingType}</p>
              ) : null}
              {displayProductCode ? (
                <p className="pp-info__code">Product Code: {displayProductCode}</p>
              ) : null}
              {(() => {
                // This badge anchors to the review section, so it goes away with
                // it — otherwise "6 reviews" links to nothing.
                if (!PDP_REVIEWS_VISIBLE) return null
                // Honest rating only: backend aggregate, else average of real
                // approved reviews on this page — never an invented default.
                const realRating =
                  product.rating > 0
                    ? product.rating
                    : reviews.length > 0
                      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                      : 0
                const realCount = product.reviewCount || reviews.length
                if (realCount <= 0 || realRating <= 0) return null
                return (
                  <a href="#product-reviews-heading" className="pp-info__rating">
                    <span className="pp-info__stars" aria-hidden>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            'pp-info__star',
                            i < Math.round(realRating) && 'pp-info__star--filled',
                          )}
                          strokeWidth={1.5}
                        />
                      ))}
                    </span>
                    <span>{realRating.toFixed(1)}</span>
                    <span className="pp-info__rating-sep">·</span>
                    <span>
                      {realCount} review{realCount === 1 ? '' : 's'}
                    </span>
                  </a>
                )
              })()}
            </ProductReveal>

            <ProductReveal className="pp-info__lead">
              <ProductPrice
                price={unitPrice}
                compareAtPrice={compareAtPrice}
                className="pp-info__price-row"
                priceClassName="pp-info__price"
                compareClassName="pp-info__compare"
                badgeClassName="pp-info__discount-badge"
                showBadge
                badgeLabelStyle="off"
              />
            </ProductReveal>

            <AnimatePresence mode="wait">
              {/* Low-stock urgency lives in the size-row stock pill when sizes show */}
              {lowStock && !sizeOptionUi.showSelector ? (
                <motion.p
                  key="low-stock"
                  className="pp-info__lowstock"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.24, ease: productGalleryEase }}
                >
                  {resolveStockStatus(stock).label}
                </motion.p>
              ) : null}
              {product.inventoryPolicy === 'PREORDER' ? (
                <motion.p
                  key="preorder"
                  className="pp-info__lowstock"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.24, ease: productGalleryEase }}
                >
                  Pre-order
                  {product.preorderReleaseAt
                    ? ` · Expected ${new Date(product.preorderReleaseAt).toLocaleDateString('en-BD', { day: 'numeric', month: 'long', year: 'numeric' })}`
                    : ''}
                </motion.p>
              ) : product.inventoryPolicy === 'CONTINUE' && !selectionInStock ? (
                <motion.p key="backorder" className="pp-info__lowstock">
                  Available on backorder
                </motion.p>
              ) : !sellableProduct ? (
                <motion.p
                  key="out-stock"
                  className="pp-info__outstock"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.24, ease: productGalleryEase }}
                >
                  Out of stock
                </motion.p>
              ) : !selectionInStock ? (
                <motion.p
                  key="variant-out-stock"
                  className="pp-info__outstock"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.24, ease: productGalleryEase }}
                >
                  This size / colour is out of stock — try another
                </motion.p>
              ) : null}
            </AnimatePresence>

            <ProductReveal>
            <div ref={optionsRef} className="pp-info__options">
              {showColorPicker && (
                <div className="pp-info__option">
                  <p className="pp-info__option-label">
                    Color:{' '}
                    <AnimatePresence mode="wait" initial={false}>
                      <ProductFadeSwap
                        key={selectedColorName}
                        motionKey={selectedColorName}
                        className="pp-info__option-value"
                      >
                        {selectedColorName}
                      </ProductFadeSwap>
                    </AnimatePresence>
                  </p>
                  <HorizontalScrollRail
                    className="pp-color-rail"
                    trackClassName="pp-color-row"
                    variant="pill"
                    ariaLabel="Product colours"
                  >
                    {colorOptions.map((opt) => (
                      <MotionPressable
                        key={opt.hex}
                        type="button"
                        onClick={() => setSelectedColor(opt.hex)}
                        aria-label={`${opt.name} colour`}
                        aria-pressed={selectedColor === opt.hex}
                        className={cn(
                          'pp-color-thumb pp-pressable',
                          selectedColor === opt.hex && 'pp-color-thumb--active',
                        )}
                        variant="chip"
                      >
                        {/* 76×90 matches the CSS-rendered 4.75×5.65rem ratio —
                            square intrinsics triggered the next/image aspect-ratio
                            console warning. */}
                        <StorefrontImage
                          src={opt.image}
                          alt=""
                          profile="thumb"
                          width={76}
                          height={90}
                          fit="cover"
                          className="pp-color-thumb__img"
                        />
                      </MotionPressable>
                    ))}
                  </HorizontalScrollRail>
                </div>
              )}

              {sizeOptionUi.showSelector ? (
                <div className="pp-info__option pp-info__option--size">
                  <div className="pp-info__option-head">
                    <p className="pp-info__option-label pp-info__option-label--inline">
                      {sizeOptionUi.kind === 'footwear' ? 'Select Shoe Size' : 'Select Size'}
                    </p>
                    {sizeOptionUi.showSizeGuide ? (
                      <MotionPressable
                        type="button"
                        className="pp-size-guide"
                        variant="subtle"
                        onClick={() => setSizeGuideOpen(true)}
                      >
                        <span className="pp-size-guide__label">Size Guide</span>
                        <Ruler className="h-4 w-4" strokeWidth={1.75} />
                      </MotionPressable>
                    ) : null}
                  </div>
                  <motion.div
                    ref={sizeRowRef}
                    className="pp-size-row"
                    role="group"
                    aria-label={sizeOptionUi.ariaLabel}
                    variants={productShake}
                    animate={sizeShake && showMotion ? 'shake' : 'idle'}
                  >
                    {sizes.map((size) => {
                      const qty = sizeStock.get(size) ?? 0
                      const disabled = qty === 0 && !allowOversell
                      const active = selectedSize === size && !disabled
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => !disabled && setSelectedSize(size)}
                          aria-pressed={active}
                          aria-label={
                            disabled
                              ? `${sizeOptionUi.ariaLabel} ${size}, out of stock`
                              : `${sizeOptionUi.ariaLabel} ${size}`
                          }
                          disabled={disabled}
                          className={cn(
                            'pp-size-btn',
                            active && 'pp-size-btn--active',
                            disabled && 'pp-size-btn--unavailable',
                          )}
                        >
                          {active ? (
                            showMotion ? (
                              <motion.span
                                layoutId={`pp-size-liquid-${product.id}`}
                                className="pp-size-btn__bubble"
                                transition={SIZE_LIQUID_SPRING}
                                aria-hidden
                              />
                            ) : (
                              <span className="pp-size-btn__bubble" aria-hidden />
                            )
                          ) : null}
                          <span className="pp-size-btn__label">{size}</span>
                        </button>
                      )
                    })}
                  </motion.div>
                  {selectedSize && sizeStockStatus ? (
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={`${selectedSize}-${sizeStockStatus.kind}-${sizeStockStatus.units}`}
                        className={cn(
                          'pp-size-stock',
                          sizeStockStatus.kind === 'in_stock' && 'pp-size-stock--ok',
                          sizeStockStatus.kind === 'only_left' && 'pp-size-stock--urgent',
                          sizeStockStatus.kind === 'sold_out' && 'pp-size-stock--out',
                          sizeStockStatus.kind === 'preorder' && 'pp-size-stock--ok',
                        )}
                        initial={showMotion ? { opacity: 0, y: 6, scale: 0.96 } : false}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        {...(showMotion
                          ? { exit: { opacity: 0, y: -4, scale: 0.98 } }
                          : {})}
                        transition={SIZE_LIQUID_SPRING}
                        aria-live="polite"
                      >
                        {selectedSize} · {sizeStockStatus.label}
                      </motion.p>
                    </AnimatePresence>
                  ) : null}
                </div>
              ) : null}
            </div>
            </ProductReveal>

            <ProductReveal className="pp-info__option">
              <p className="pp-info__option-label">Quantity</p>
              <div className="pp-qty">
                <MotionPressable
                  type="button"
                  className="pp-qty__btn"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  disabled={quantity <= 1}
                  variant="icon"
                >
                  <Minus className="h-3.5 w-3.5" strokeWidth={2.2} />
                </MotionPressable>
                <span className="pp-qty__value" aria-live="polite">
                  {quantity}
                </span>
                <MotionPressable
                  type="button"
                  className="pp-qty__btn"
                  onClick={() => setQuantity((q) => Math.min(Math.max(1, stock), q + 1))}
                  aria-label="Increase quantity"
                  disabled={quantity >= stock}
                  variant="icon"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
                </MotionPressable>
              </div>
            </ProductReveal>

            <div className="pp-info__purchase-panel">
            <ProductReveal>
            <motion.div
              ref={ctaRef}
              className="pp-info__ctas"
              variants={productShake}
              animate={ctaShake && showMotion ? 'shake' : 'idle'}
            >
              <MotionPressable
                type="button"
                className={cn(
                  'pp-btn-add pp-pressable',
                  addedPulse && 'pp-btn-add--added',
                  addingToCart && !addedPulse && 'pp-btn-add--pending',
                )}
                onClick={handleAddToCart}
                disabled={!sellableProduct || !sellableSelection || addingToCart}
                variant="cta"
              >
                <AddToBagIcon size={17} strokeWidth={1.75} className="pp-btn-add__icon" />
                <MotionSwapLabel
                  id={
                    addingToCart && !addedPulse
                      ? 'pending'
                      : addedPulse
                        ? 'added'
                        : 'default'
                  }
                >
                  {addingToCart && !addedPulse
                    ? 'Adding…'
                    : addedPulse
                      ? 'Added to Bag!'
                      : 'Add to bag'}
                </MotionSwapLabel>
              </MotionPressable>

              <MotionPressable
                type="button"
                className="pp-btn-store pp-pressable"
                onClick={handleBuyNow}
                onPointerEnter={() => router.prefetch(getCheckoutEntryPath())}
                disabled={!sellableProduct || !sellableSelection}
                variant="cta"
              >
                Buy Now
              </MotionPressable>
            </motion.div>
            </ProductReveal>

            {shareUrl ? (
              <div className="pp-share pp-share--inline" aria-label="Share product">
                <MotionAnchor
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pp-share__btn"
                  aria-label="Share on Facebook"
                  variant="icon"
                >
                  <FacebookIcon className="pp-share__icon" />
                </MotionAnchor>
                <MotionAnchor
                  href={`https://wa.me/?text=${encodeURIComponent(`${product.name} ${shareUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pp-share__btn"
                  aria-label="Share on WhatsApp"
                  variant="icon"
                >
                  <WhatsAppIcon className="pp-share__icon" />
                </MotionAnchor>
                <MotionAnchor
                  href={`https://www.facebook.com/dialog/send?link=${encodeURIComponent(shareUrl)}&app_id=966242223397117&redirect_uri=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pp-share__btn"
                  aria-label="Share on Messenger"
                  variant="icon"
                >
                  <MessengerIcon className="pp-share__icon" />
                </MotionAnchor>
                <MotionAnchor
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(product.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pp-share__btn"
                  aria-label="Share on X"
                  variant="icon"
                >
                  <XSocialIcon className="pp-share__icon" />
                </MotionAnchor>
              </div>
            ) : null}

            <ProductReveal>
              <ProductPurchaseExtras product={product} price={unitPrice} variant="payments" />
            </ProductReveal>
            </div>
            </ProductStagger>

            {(shortDesc || fullDescription || detailSections.length > 0) && (
              <section className="pp-info__details" aria-label="Product details">
                {(fullDescription || shortDesc) && (
                  <div className="pp-info__desc-block">
                    <div className="pp-info__desc-head">
                      <span className="pp-info__desc-eyebrow" lang={showBangla ? 'bn' : 'en'}>
                        {showBangla ? 'পণ্য পরিচিতি' : 'The piece'}
                      </span>
                      {descriptionBn.length > 0 && (
                        <div
                          className="pp-lang"
                          role="group"
                          aria-label="Description language / বিবরণের ভাষা"
                        >
                          <button
                            type="button"
                            className={cn('pp-lang__opt', !showBangla && 'pp-lang__opt--on')}
                            onClick={() => chooseDescLang('en')}
                            aria-pressed={!showBangla}
                            lang="en"
                            data-no-press
                          >
                            EN
                          </button>
                          <button
                            type="button"
                            className={cn('pp-lang__opt', showBangla && 'pp-lang__opt--on')}
                            onClick={() => chooseDescLang('bn')}
                            aria-pressed={showBangla}
                            lang="bn"
                            data-no-press
                          >
                            বাং
                          </button>
                        </div>
                      )}
                    </div>
                    <div
                      id="pp-product-description"
                      lang={showBangla ? 'bn' : 'en'}
                      className={cn(
                        'pp-info__desc',
                        showBangla && 'pp-info__desc--bn',
                        showReadMore && !descExpanded && !showBangla && 'pp-info__desc--clamped',
                        descExpanded && 'pp-info__desc--expanded',
                      )}
                    >
                      {showBangla
                        ? renderFormattedDescription(descriptionBn)
                        : renderFormattedDescription(fullDescription || shortDesc)}
                    </div>
                    {showReadMore && !showBangla && (
                      <MotionPressable
                        type="button"
                        className="pp-info__read-more"
                        onClick={() => setDescExpanded((v) => !v)}
                        aria-expanded={descExpanded}
                        aria-controls="pp-product-description"
                        variant="subtle"
                      >
                        <span>{descExpanded ? 'Read less' : 'Read more'}</span>
                        <ChevronDown
                          className={cn(
                            'pp-info__read-more-icon',
                            descExpanded && 'pp-info__read-more-icon--open',
                          )}
                          strokeWidth={1.8}
                          aria-hidden
                        />
                      </MotionPressable>
                    )}
                  </div>
                )}

                {detailSections.length > 0 && (
                  <div className="pp-info__accordions">
                    {detailSections.map((section) => {
                      const open = openSection === section.id
                      const SectionIcon = section.icon
                      const sectionKey = section.id.toLowerCase().replace(/\s+/g, '-')
                      const triggerId = `pp-acc-trigger-${sectionKey}`
                      const panelId = `pp-acc-panel-${sectionKey}`
                      return (
                        <div
                          key={section.id}
                          className={cn('pp-accordion', open && 'pp-accordion--open')}
                        >
                          <MotionPressable
                            type="button"
                            id={triggerId}
                            className="pp-accordion__trigger pp-pressable"
                            onClick={() => setOpenSection(open ? null : section.id)}
                            aria-expanded={open}
                            aria-controls={panelId}
                            variant="subtle"
                          >
                            <span className="pp-accordion__title">
                              <SectionIcon
                                className="pp-accordion__title-icon"
                                strokeWidth={1.7}
                                aria-hidden
                              />
                              <span className="pp-accordion__title-copy">
                                <span className="pp-accordion__title-label">{section.id}</span>
                                <span className="pp-accordion__summary">
                                  {DETAIL_SECTION_SUMMARY[section.id] ??
                                    DETAIL_SECTION_SUMMARY_FALLBACK}
                                </span>
                              </span>
                            </span>
                            <motion.span
                              {...(reducedMotion
                                ? {}
                                : { animate: { rotate: open ? 45 : 0 } })}
                              transition={{ duration: PANEL_MS, ease: PANEL_EASE }}
                              className="pp-accordion__icon"
                              aria-hidden
                            >
                              <Plus className="h-3 w-3" strokeWidth={2} />
                            </motion.span>
                          </MotionPressable>
                          {/* All panels use CSS grid expand — Framer height:auto caused layout jump. */}
                          <div
                            id={panelId}
                            role="region"
                            aria-labelledby={triggerId}
                            aria-hidden={!open}
                            {...(!open ? { inert: true as const } : {})}
                            className={cn(
                              'pp-accordion__panel',
                              'pp-accordion__panel--story',
                              !open && 'pp-accordion__panel--collapsed',
                            )}
                          >
                            <div className="pp-accordion__panel-inner">
                              {section.id === 'Shipping' ? (
                                <PdpShippingStory active={open} lines={section.lines} />
                              ) : section.id === 'Care' ? (
                                <PdpCareStory active={open} lines={section.lines} />
                              ) : (
                                <ul className="pp-accordion__list">
                                  {section.lines.map((line) => {
                                    const LineIcon = line.icon
                                    return (
                                      <li key={line.text} className="pp-accordion__item">
                                        <LineIcon
                                          className="pp-accordion__item-icon"
                                          strokeWidth={1.65}
                                          aria-hidden
                                        />
                                        <span>{line.text}</span>
                                      </li>
                                    )
                                  })}
                                </ul>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )}
          </aside>
        </div>

        {PDP_REVIEWS_VISIBLE ? (
          <ProductReviews
            productId={product.id}
            productSlug={product.slug}
            productName={product.name}
            rating={product.rating}
            reviewCount={product.reviewCount}
            reviews={reviews}
            isLoggedIn={authHydrated && Boolean(user)}
          />
        ) : null}
      </div>

      <ProductPurchaseSticky
        showFloating={showFloatingCta}
        inStock={sellableProduct}
        price={unitPrice}
        quantity={quantity}
        selectedSize={selectedSize}
        selectedColorLabel={
          selectedColorName !== '—' ? selectedColorName : null
        }
        addingToCart={addingToCart}
        addedPulse={addedPulse}
        onAddToCart={handleAddToCart}
        onBuyNow={handleBuyNow}
        showMotion={showMotion}
      />

      <ProductLightbox
        isOpen={isLightboxOpen}
        onClose={closeLightbox}
        productName={product.name}
        media={media}
        activeIndex={activeImage}
        onPrev={prevImage}
        onNext={nextImage}
        showMotion={galleryAnimated}
      />

      <SizeGuideModal
        open={sizeGuideOpen && sizeOptionUi.showSizeGuide}
        onClose={() => setSizeGuideOpen(false)}
        category={product.category ?? null}
        categorySlug={product.categorySlug ?? null}
        productName={product.name}
      />
    </div>
  )
}
