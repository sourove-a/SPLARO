'use client'

/** Product detail client — purchase flow + gallery (no PDP wishlist). */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type SVGProps } from 'react'
import { StorefrontImage } from '@/components/ui/StorefrontImage'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from '@/lib/motion/react'
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minus,
  Plus,
  Ruler,
  Star,
} from 'lucide-react'
import { useLenis } from 'lenis/react'
import { subscribeScroll } from '@/hooks/useScrollY'
import { AddToBagIconBadge } from '@/components/product/AddToBagIcon'
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
import { trackAddToCart, trackViewContent } from '@/lib/analytics/meta-pixel'
import type { ProductDetailData } from '@/types/product'
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/lib/assets/brand'
import { sanitizeRemoteImageUrl } from '@/lib/assets/images'
import { sanitizeStorefrontProductCode } from '@/lib/catalog/storefront-sanitize'
import { optimizeImageSrc } from '@/lib/assets/image-optimize'
import type { ProductReview } from '@/lib/catalog/live'
import { sortSizes } from '@/lib/catalog/live'
import { ProductReviews } from '@/components/product/ProductReviews/ProductReviews'
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
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [addedPulse, setAddedPulse] = useState(false)
  const [addingToCart, setAddingToCart] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [openSection, setOpenSection] = useState<string | null>(null)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false)
  const [sizeShake, setSizeShake] = useState(false)
  const sizeRowRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  const swipeRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const [showFloatingCta, setShowFloatingCta] = useState(false)
  const { shipping } = useStorefrontSettings()
  const lenis = useLenis()

  const fullDescription = product.description?.trim() ?? ''
  const shortDesc =
    product.shortDescription?.trim() ||
    (fullDescription.length > 160 ? `${fullDescription.slice(0, 157)}…` : fullDescription)
  const showReadMore = fullDescription.length > 160 && !product.shortDescription

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
    colors.find(([hex]) => hex === selectedColor)?.[1] ?? '—'

  const productHasStock = product.variants.some(
    (v) => v.isActive !== false && v.stock > 0,
  )
  const stock = activeVariant?.stock ?? 0
  const selectionInStock = stock > 0
  const inStock = selectionInStock
  const lowStock = inStock && stock <= 5
  const unitPrice = activeVariant?.price ?? product.price
  const compareAtPrice = activeVariant?.compareAtPrice ?? product.compareAtPrice
  const hasDiscount = Boolean(compareAtPrice && compareAtPrice > unitPrice)
  const discountPct = hasDiscount
    ? Math.round(((compareAtPrice! - unitPrice) / compareAtPrice!) * 100)
    : 0

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
    let footerIo: IntersectionObserver | null = null
    let unsubScroll: (() => void) | null = null
    let raf = 0
    let alive = true
    let attachTries = 0

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

      const topInset = 72
      const bottomInset = 28
      const visible =
        rect.bottom > topInset && rect.top < window.innerHeight - bottomInset
      const next = !visible
      setShowFloatingCta((prev) => (prev === next ? prev : next))
    }

    const attach = () => {
      const el = resolveCta()
      if (!el || !alive) return false
      if (attachedEl === el && io) {
        updateFloatingCta()
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

        const footer = document.querySelector('footer.site-footer, footer[data-site-chrome]')
        if (footer) {
          footerIo?.disconnect()
          footerIo = new IntersectionObserver(updateFloatingCta, {
            threshold: [0, 0.01, 0.1],
          })
          footerIo.observe(footer)
        }
      }
      return true
    }

    // Retry attach a few times if ProductReveal delays the CTA — no permanent poll (kills Lenis feel).
    const tryAttach = () => {
      if (attach() || !alive) return
      attachTries += 1
      if (attachTries < 12) {
        raf = window.requestAnimationFrame(tryAttach)
      }
    }
    tryAttach()

    unsubScroll = subscribeScroll(lenis, updateFloatingCta)
    window.addEventListener('resize', updateFloatingCta, { passive: true })

    return () => {
      alive = false
      window.cancelAnimationFrame(raf)
      io?.disconnect()
      footerIo?.disconnect()
      unsubScroll?.()
      window.removeEventListener('resize', updateFloatingCta)
    }
  }, [product.id, lenis])

  useEffect(() => {
    trackRecentlyViewed(product.id)
    trackViewContent({ id: product.id, name: product.name, price: product.price })
    setSelectedSize(sizes[0] ?? null)
    setSelectedColor(colorOptions[0]?.hex ?? null)
    setActiveImage(0)
    setQuantity(1)
    setDescExpanded(false)
    setOpenSection(null)
  }, [product.id, product.name, product.price, sizes, colorOptions])

  useEffect(() => {
    setActiveImage(0)
    if (selectedColor && selectedSize && (sizeStock.get(selectedSize) ?? 0) === 0) {
      const next = sizes.find((size) => (sizeStock.get(size) ?? 0) > 0)
      if (next) setSelectedSize(next)
    }
  }, [selectedColor, selectedSize, sizeStock, sizes])

  // Warm gallery cache: thumbs immediately, full gallery on idle.
  useEffect(() => {
    if (typeof window === 'undefined' || !media.length) return

    for (const item of media) {
      if (item?.type !== 'image' || !item.url) continue
      const thumb = new window.Image()
      thumb.decoding = 'async'
      thumb.src = optimizeImageSrc(item.url, 'thumb')
    }

    const preloadGallery = () => {
      for (const item of media) {
        if (item?.type !== 'image' || !item.url) continue
        const img = new window.Image()
        img.decoding = 'async'
        img.src = optimizeImageSrc(item.url, 'gallery')
      }
    }

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(preloadGallery, { timeout: 2200 })
      return () => window.cancelIdleCallback(idleId)
    }

    const timeoutId = globalThis.setTimeout(preloadGallery, 600)
    return () => globalThis.clearTimeout(timeoutId)
  }, [media])

  useEffect(() => {
    if (typeof window === 'undefined' || !media.length) return
    const neighbours = [
      media[(activeImage + 1) % media.length],
      media[(activeImage - 1 + media.length) % media.length],
    ]
    for (const item of neighbours) {
      if (item?.type !== 'image' || !item.url) continue
      const img = new window.Image()
      img.decoding = 'async'
      img.src = optimizeImageSrc(item.url, 'gallery')
    }
  }, [activeImage, media])

  useEffect(() => {
    setQuantity((q) => Math.min(Math.max(1, q), Math.max(1, stock)))
  }, [stock])

  const detailSections = useMemo(() => {
    const sections: { id: string; content: string }[] = []

    const detailsParts = [
      fullDescription,
      product.weavingType ? `Weaving · ${product.weavingType}` : null,
      product.fabricContent ? `Materials · ${product.fabricContent}` : null,
      product.occasion ? `Occasion · ${product.occasion}` : null,
      product.season ? `Season · ${product.season}` : null,
    ].filter(Boolean) as string[]

    if (detailsParts.length > 0) {
      sections.push({ id: 'Details', content: detailsParts.join('\n\n') })
    }

    const shippingParts = [
      `Delivery: Dhaka ${formatBDT(Math.round(shipping.dhakaDeliveryCharge))} · Outside ${formatBDT(Math.round(shipping.outsideDhakaCharge))}.`,
      shipping.freeDeliveryThreshold > 0
        ? `Free delivery on orders over ${formatBDT(Math.round(shipping.freeDeliveryThreshold))}.`
        : null,
      'Most orders arrive within 2–4 business days.',
      product.origin ? `Origin · ${product.origin}` : null,
    ].filter(Boolean) as string[]

    sections.push({ id: 'Shipping', content: shippingParts.join('\n\n') })

    const careParts = [
      product.careInstructions,
      product.fitType ? `Fit · ${product.fitType}` : null,
    ].filter(Boolean) as string[]

    if (careParts.length > 0) {
      sections.push({ id: 'Care', content: careParts.join('\n\n') })
    }

    return sections
  }, [
    fullDescription,
    product.careInstructions,
    product.fabricContent,
    product.weavingType,
    product.fitType,
    product.occasion,
    product.origin,
    product.season,
    shipping.dhakaDeliveryCharge,
    shipping.outsideDhakaCharge,
    shipping.freeDeliveryThreshold,
  ])

  const buildSelectedCartItem = (): CartItem | null => {
    if (!productHasStock || !selectionInStock) return null
    // Synthetic variant ids (product.id or `${product.id}-…`) are UI-only —
    // the API rejects them, so only send ids that came from the database.
    const realVariantId =
      activeVariant?.id &&
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
    trackAddToCart({ id: product.id, name: product.name, price: unitPrice })
    return true
  }

  /** Prefer Lenis — native scrollIntoView desyncs virtual scroll and breaks follow-up clicks. */
  const scrollElIntoView = (el: HTMLElement | null) => {
    if (!el) return
    if (lenis) {
      lenis.scrollTo(el, { offset: -96, duration: 0.65 })
      return
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const validatePurchaseSelection = (): boolean => {
    if (!productHasStock) {
      setCtaShake(true)
      window.setTimeout(() => setCtaShake(false), 480)
      toast.error('This product is out of stock')
      return false
    }
    if (!selectionInStock) {
      setCtaShake(true)
      scrollElIntoView(optionsRef.current)
      toast.error('This size or colour is out of stock — try another')
      window.setTimeout(() => setCtaShake(false), 480)
      return false
    }
    if (sizes.length > 0) {
      if (!selectedSize) {
        setSizeShake(true)
        scrollElIntoView(sizeRowRef.current)
        toast.error('Please select a size')
        window.setTimeout(() => setSizeShake(false), 520)
        return false
      }
      if ((sizeStock.get(selectedSize) ?? 0) === 0) {
        setSizeShake(true)
        scrollElIntoView(sizeRowRef.current)
        toast.error('Selected size is out of stock')
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
    trackAddToCart({ id: product.id, name: product.name, price: unitPrice })
    safeClientNavigate(router, getCheckoutEntryPath(Boolean(user)))
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
    if (swipeRef.current?.moved) return
    // Tap cycles photos; expand button / double-click opens fullscreen zoom
    if (media.length > 1) {
      nextImage()
      return
    }
    openLightbox()
  }

  const onGalleryPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (media[activeImage]?.type === 'video' || media.length < 2) return
    swipeRef.current = { x: event.clientX, y: event.clientY, moved: false }
  }

  const onGalleryPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeRef.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) > 12 || Math.abs(dy) > 12) start.moved = true
  }

  const onGalleryPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeRef.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    const swiped = start.moved && Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy)
    swipeRef.current = swiped ? { ...start, moved: true } : null
    if (!swiped) {
      swipeRef.current = null
      return
    }
    if (dx < 0) nextImage()
    else prevImage()
    window.setTimeout(() => {
      swipeRef.current = null
    }, 0)
  }

  const onGalleryPointerCancel = () => {
    swipeRef.current = null
  }

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
          <span aria-hidden>/</span>
          <span aria-current="page">{product.name}</span>
        </nav>

        <div className="pp-grid">
          {/* ─── Gallery ─────────────────────────────────── */}
          <div className="pp-gallery">
            <div className="pp-gallery__main">
              <div
                className={cn(
                  'pp-gallery__stage pp-gallery__stage--stack',
                  media[activeImage]?.type !== 'video' && 'pp-gallery__stage--zoomable',
                )}
                onPointerDown={onGalleryPointerDown}
                onPointerMove={onGalleryPointerMove}
                onPointerUp={onGalleryPointerUp}
                onPointerCancel={onGalleryPointerCancel}
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
                {galleryAnimated
                  ? media.map((item, i) => (
                      <motion.div
                        key={`${selectedColor ?? 'default'}-${item.type}-${item.url}-${i}`}
                        className="pp-gallery__slide"
                        animate={{ opacity: i === activeImage ? 1 : 0 }}
                        transition={{ duration: PRODUCT_GALLERY_MS, ease: productGalleryEase }}
                        style={{
                          pointerEvents: i === activeImage ? 'auto' : 'none',
                          zIndex: i === activeImage ? 2 : 1,
                        }}
                        aria-hidden={i !== activeImage}
                      >
                        {renderGallerySlide(item, i)}
                      </motion.div>
                    ))
                  : renderGallerySlide(media[activeImage]!, activeImage)}
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
                </>
              )}
            </div>

            {/* Colour thumbs choose look; arrows / stage click cycle gallery — no second thumb strip. */}
            {media.length > 1 ? (
              <span className="sr-only" aria-live="polite">
                Image {activeImage + 1} of {media.length}
              </span>
            ) : null}
          </div>

          {/* ─── Product info ─────────────────────────────── */}
          <aside className="pp-info">
            <ProductStagger>
            <ProductReveal className="pp-info__header">
              <h1 className="pp-info__name">{product.name}</h1>
              {product.nameBn ? (
                <p className="pp-info__name-bn" lang="bn">{product.nameBn}</p>
              ) : null}
              {product.weavingType ? (
                <p className="pp-info__weave">{product.weavingType}</p>
              ) : null}
              {displayProductCode ? (
                <p className="pp-info__code">Product Code: {displayProductCode}</p>
              ) : null}
              {(() => {
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
              <div className="pp-info__price-row">
                <span className="pp-info__price">{formatBDT(unitPrice)}</span>
                {hasDiscount && (
                  <>
                    <span className="pp-info__compare">{formatBDT(compareAtPrice!)}</span>
                    <span className="pp-info__discount-badge">-{discountPct}%</span>
                  </>
                )}
              </div>
              <ProductPurchaseExtras product={product} price={unitPrice} variant="highlights" />
              <ProductPurchaseExtras product={product} price={unitPrice} variant="delivery" />
            </ProductReveal>

            <AnimatePresence mode="wait">
              {lowStock && (
                <motion.p
                  key="low-stock"
                  className="pp-info__lowstock"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.24, ease: productGalleryEase }}
                >
                  Only {stock} left — order soon
                </motion.p>
              )}
              {!productHasStock ? (
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
                        <StorefrontImage
                          src={opt.image}
                          alt=""
                          profile="thumb"
                          width={56}
                          height={56}
                          className="pp-color-thumb__img"
                        />
                      </MotionPressable>
                    ))}
                  </HorizontalScrollRail>
                </div>
              )}

              {sizes.length > 0 && (
                <div className="pp-info__option">
                  <div className="pp-info__option-head">
                    <p className="pp-info__option-label pp-info__option-label--inline">Select Size</p>
                    <MotionPressable
                      type="button"
                      className="pp-size-guide"
                      variant="subtle"
                      onClick={() => setSizeGuideOpen(true)}
                    >
                      <Ruler className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Size Guide
                    </MotionPressable>
                  </div>
                  <LayoutGroup id="pp-size-select">
                  <motion.div
                    ref={sizeRowRef}
                    className="pp-size-row"
                    variants={productShake}
                    animate={sizeShake && showMotion ? 'shake' : 'idle'}
                  >
                    {sizes.map((size) => {
                      const qty = sizeStock.get(size) ?? stock
                      const disabled = qty === 0
                      const active = selectedSize === size && !disabled
                      return (
                        <MotionPressable
                          key={size}
                          type="button"
                          onClick={() => !disabled && setSelectedSize(size)}
                          aria-pressed={active}
                          disabled={disabled}
                          className={cn(
                            'pp-size-btn pp-pressable',
                            active && 'pp-size-btn--active pp-size-btn--sliding',
                            disabled && 'pp-size-btn--unavailable',
                          )}
                          variant="chip"
                        >
                          {active && (
                            <motion.span
                              layoutId="pp-size-pill"
                              className="pp-size-btn__pill"
                              transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                              aria-hidden
                            />
                          )}
                          <span className="pp-size-btn__label">{size}</span>
                        </MotionPressable>
                      )
                    })}
                  </motion.div>
                  </LayoutGroup>
                </div>
              )}
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
                disabled={!productHasStock || !selectionInStock || addingToCart}
                variant="cta"
              >
                <AddToBagIconBadge size={17} tone="dark" pulse={addedPulse} />
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
                disabled={!productHasStock || !selectionInStock}
                variant="cta"
              >
                Buy Now
              </MotionPressable>

              {shareUrl ? (
                <div className="pp-share" aria-label="Share product">
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
            </motion.div>
            </ProductReveal>

            <ProductReveal>
              <ProductPurchaseExtras product={product} price={unitPrice} variant="payments" />
            </ProductReveal>
            </div>
            </ProductStagger>

            {(shortDesc || detailSections.length > 0) && (
              <section className="pp-info__details" aria-label="Product details">
                {shortDesc && (
                  <div className="pp-info__desc-block">
                    <p
                      className={cn(
                        'pp-info__desc',
                        descExpanded && 'pp-info__desc--expanded',
                      )}
                    >
                      {descExpanded || !showReadMore ? fullDescription || shortDesc : shortDesc}
                    </p>
                    {showReadMore && (
                      <MotionPressable
                        type="button"
                        className="pp-info__read-more"
                        onClick={() => setDescExpanded((v) => !v)}
                        variant="subtle"
                      >
                        {descExpanded ? 'Read less' : 'Read more'}
                      </MotionPressable>
                    )}
                  </div>
                )}

                {detailSections.length > 0 && (
                  <div className="pp-info__accordions">
                    {detailSections.map((section) => {
                      const open = openSection === section.id
                      return (
                        <div
                          key={section.id}
                          className={cn('pp-accordion', open && 'pp-accordion--open')}
                        >
                          <MotionPressable
                            type="button"
                            className="pp-accordion__trigger pp-pressable"
                            onClick={() => setOpenSection(open ? null : section.id)}
                            aria-expanded={open}
                            variant="subtle"
                          >
                            <span>{section.id}</span>
                            <motion.span
                              animate={{ rotate: open ? 45 : 0 }}
                              transition={{ duration: PANEL_MS, ease: PANEL_EASE }}
                              className="pp-accordion__icon"
                            >
                              <Plus className="h-3 w-3" strokeWidth={2} />
                            </motion.span>
                          </MotionPressable>
                          <AnimatePresence initial={false}>
                            {open && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: PANEL_MS, ease: PANEL_EASE }}
                                className="pp-accordion__panel"
                              >
                                <p className="pp-accordion__body">{section.content}</p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )}
          </aside>
        </div>

        <ProductReviews
          productId={product.id}
          productSlug={product.slug}
          productName={product.name}
          rating={product.rating}
          reviewCount={product.reviewCount}
          reviews={reviews}
          isLoggedIn={authHydrated && Boolean(user)}
        />
      </div>

      <ProductPurchaseSticky
        showFloating={showFloatingCta}
        inStock={productHasStock}
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
        open={sizeGuideOpen}
        onClose={() => setSizeGuideOpen(false)}
        category={product.category ?? null}
        categorySlug={product.categorySlug ?? null}
        productName={product.name}
      />
    </div>
  )
}
