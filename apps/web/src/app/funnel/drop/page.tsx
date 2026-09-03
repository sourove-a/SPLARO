'use client'

import { useState, useEffect, useMemo, useId, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import Script from 'next/script'
import { BD_DISTRICT_LIST, getDistrictBanglaName } from '@/lib/checkout/bd-districts'
import { FunnelImageZoomModal } from '@/components/funnel/FunnelImageZoomModal'
import '@/styles/funnel-engine.css'

/** The checkout boxes a validation message can point at. */
type CheckoutField = 'name' | 'phone' | 'email' | 'address'

/**
 * The validation message repeated under the box it belongs to. The banner at
 * the top of the card still carries it, but that banner is off-screen for a
 * shopper who has scrolled down to the order button.
 */
function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p
      id={id}
      role="alert"
      style={{
        margin: '6px 0 0',
        fontSize: 13,
        fontWeight: 700,
        color: '#f87171',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
      }}
    >
      <span aria-hidden="true">⚠️</span>
      <span>{children}</span>
    </p>
  )
}

/**
 * Merchant copy almost always ships with its own leading icon — the delivery
 * line is stored as "⚡ ঢাকা সিটিতে…", the guarantee as "🛡️ ১০০%…". Rendering
 * our own icon beside it printed the same symbol twice. Ask the string first.
 */
/**
 * A custom theme used to set six of the fifteen variables the presets define,
 * so a merchant who picked their own colours got a page with no borders, no
 * glass tint, and — measured on a live drop — white button text on a mid-green
 * fill at roughly 2.3:1. The rest are derived here from the same two colours.
 */
function hexToRgb(hex: string): [number, number, number] | null {
  const value = hex.trim().replace('#', '')
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value
  if (full.length !== 6 || !/^[0-9a-f]{6}$/i.test(full)) return null
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

function rgba(hex: string, alpha: number): string | null {
  const rgb = hexToRgb(hex)
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})` : null
}

/** WCAG relative luminance — the input to the contrast ratio below. */
function luminance(hex: string): number | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Black or white on this fill, whichever is actually more readable.
 *
 * A luminance threshold was not enough: the live drop's #5cc12b sits at 0.40,
 * under any sensible cut-off, and still carries white text at about 2.3:1.
 * Comparing both ratios picks the dark text that scores 8:1 instead.
 */
function readableInkOn(hex: string): string {
  const lum = luminance(hex)
  if (lum === null) return '#ffffff'
  const withWhite = 1.05 / (lum + 0.05)
  const withInk = (lum + 0.05) / (luminance('#0b0c0e')! + 0.05)
  return withInk >= withWhite ? '#0b0c0e' : '#ffffff'
}

/** Move a colour toward white by `amount` (0–1) — the preset hover pattern. */
function lighten(hex: string, amount: number): string | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const mixed = rgb.map((channel) => Math.round(channel + (255 - channel) * amount))
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

const LEADING_EMOJI_RE = /^\s*\p{Extended_Pictographic}/u

function hasLeadingEmoji(text?: string | null): boolean {
  return typeof text === 'string' && LEADING_EMOJI_RE.test(text)
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

function WhatsAppIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.698.073-2.123-.518-1.715-.71-2.825-2.453-2.91-2.566-.085-.114-.693-.923-.693-1.761s.437-1.25.592-1.424c.155-.174.341-.218.455-.218.114 0 .228.001.328.006.105.006.246-.04.385.295.144.347.491 1.2.535 1.288.043.088.072.19.014.305-.058.114-.087.186-.173.287-.087.1-.183.223-.262.3-.087.086-.177.18-.076.353.101.173.449.741.964 1.201.662.591 1.221.774 1.394.86.173.086.275.073.376-.043.101-.116.433-.506.549-.68.116-.173.232-.144.39-.086.158.058 1.004.474 1.177.561.173.086.289.13.332.202.043.072.043.419-.101.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.158.57 4.184 1.564 5.938l-1.564 5.714 5.864-1.538c1.688.924 3.626 1.458 5.688 1.458 6.627 0 12-5.373 12-12 0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

interface FunnelData {
  storeId: string
  storeName: string
  slug?: string
  themePreset: string
  customColors?: Record<string, string>
  headline?: string
  subheadline?: string
  heroMediaUrl?: string
  heroMediaType?: 'image' | 'video'
  bulletPoints?: string[]
  product: {
    id: string
    title: string
    slug: string
    sku?: string
    productCode?: string
    price: number
    compareAtPrice?: number
    description: string
    images: string[]
    variants?: Array<{
      id: string
      name: string
      sku: string
      price: number
      stock: number
    }>
  } | null
  deliveryMatrix: {
    insideDhaka: number
    outsideDhaka: number
  }
  ctaText?: string
  urgencyText?: string
  guaranteeBadge?: string
  whatsappNumber?: string
  facebookPixelId?: string
  videoUrl?: string
  productLanguage?: 'bn' | 'en'
  customProductTitle?: string
  customProductDescription?: string
  customProductPrice?: number
  customCompareAtPrice?: number
  heroBadgeText?: string
  reviewRatingText?: string
  deliveryTimelineText?: string
  bundleTier2Discount?: number
  bundleTier3Discount?: number
  bundleTier1Tag?: string
  bundleTier2Tag?: string
  bundleTier3Tag?: string
  themeName?: string
}

function resolveVideoEmbed(rawUrl?: string | null): { type: 'youtube' | 'vimeo' | 'video'; embedUrl: string } | null {
  if (!rawUrl || !rawUrl.trim()) return null
  const url = rawUrl.trim()

  // 1. YouTube Short / Standard / Shorts / Embed
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/)
  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1]
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=0&loop=1&playlist=${videoId}&playsinline=1&controls=1&rel=0`,
    }
  }

  // 2. Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/)
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      type: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&loop=1&autopause=0`,
    }
  }

  // 3. Direct video file (mp4, webm) or streaming link
  return {
    type: 'video',
    embedUrl: url,
  }
}

export default function FunnelDropPage() {
  const [funnel, setFunnel] = useState<FunnelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Order Form State
  const [quantity, setQuantity] = useState(1)
  const [selectedVariantId, setSelectedVariantId] = useState<string>('')
  const [activeMediaTab, setActiveMediaTab] = useState<'video' | 'image'>('image')
  const [selectedImageIdx, setSelectedImageIdx] = useState<number>(0)
  const [isZoomOpen, setIsZoomOpen] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [shippingDistrict, setShippingDistrict] = useState('Dhaka')
  const [shippingAddress, setShippingAddress] = useState('')
  const [paymentMethod] = useState<'CASH_ON_DELIVERY' | 'BKASH'>('CASH_ON_DELIVERY')
  const [submitting, setSubmitting] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState<{
    invoiceNumber: string
    total: number
    deliveryCharge: number
    name: string
    phone: string
    email?: string | undefined
    address: string
  } | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  /** Which box the message is about, so the page can take the shopper to it. */
  const [errorField, setErrorField] = useState<CheckoutField | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const addressRef = useRef<HTMLTextAreaElement>(null)

  // Unique Idempotency Key
  const idempotencyId = useId()

  useEffect(() => {
    async function loadFunnel() {
      try {
        const host = window.location.host
        const params = new URLSearchParams(window.location.search)
        const slug = params.get('drop') || params.get('slug') || ''
        const url = `/api/funnel/resolve?host=${encodeURIComponent(host)}${slug ? `&slug=${encodeURIComponent(slug)}` : ''}`
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          if (data && data.storeId && data.product) {
            setFunnel(data)
            if (data.heroMediaType === 'video' && data.videoUrl) {
              setActiveMediaTab('video')
            } else {
              setActiveMediaTab('image')
            }
            if (data.product?.variants && data.product.variants.length > 0) {
              setSelectedVariantId(data.product.variants[0].id)
            }
            setLoading(false)
            return
          }
        }
        setNotFound(true)
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    void loadFunnel()
  }, [])

  // Price calculations
  const productPrice = funnel?.product?.price ?? 0
  const isDhaka = shippingDistrict.toLowerCase().includes('dhaka')
  const deliveryCharge = isDhaka
    ? (funnel?.deliveryMatrix?.insideDhaka ?? 70)
    : (funnel?.deliveryMatrix?.outsideDhaka ?? 130)
  const tier2Discount = funnel?.bundleTier2Discount ?? 200
  const tier3Discount = funnel?.bundleTier3Discount ?? 450

  const videoEmbedInfo = useMemo(() => resolveVideoEmbed(funnel?.videoUrl), [funnel?.videoUrl])
  const currentImage = funnel?.product?.images?.[selectedImageIdx] || funnel?.product?.images?.[0]

  const dynamicThemeStyle = useMemo(() => {
    const st: Record<string, string> = {}
    if (funnel?.themePreset !== 'custom') return st as React.CSSProperties

    const col = funnel.customColors?.accent || funnel.customColors?.primary
    if (col && typeof col === 'string' && hexToRgb(col)) {
      st['--funnel-accent'] = col
      st['--funnel-accent-hover'] = lighten(col, 0.18) ?? col
      st['--funnel-accent-glow'] = rgba(col, 0.42) ?? `${col}40`
      st['--funnel-grid-line'] = rgba(col, 0.16) ?? `${col}25`
      st['--funnel-border'] = rgba(col, 0.28) ?? `${col}45`
      st['--funnel-border-hover'] = rgba(col, 0.62) ?? col
      st['--funnel-glass-highlight'] = rgba(col, 0.34) ?? 'rgba(255, 255, 255, 0.4)'
      st['--funnel-btn-bg'] = col
      st['--funnel-spotlight'] = `radial-gradient(ellipse at 50% -10%, ${rgba(col, 0.32) ?? `${col}35`} 0%, rgba(0, 0, 0, 0) 75%)`

      // The presets hard-code this pair; a custom colour has to work it out, or
      // a green button ships white text at 2.3:1.
      st['--funnel-btn-text'] = readableInkOn(col)
      st['--funnel-text-muted'] = rgba(col, 0.72) ?? 'rgba(255, 255, 255, 0.72)'
    }

    const bg = funnel.customColors?.bg
    if (bg && typeof bg === 'string' && hexToRgb(bg)) {
      st['--funnel-bg'] = bg
      // Surfaces sit just above the page, the way every preset builds them.
      st['--funnel-surface'] = lighten(bg, 0.06) ?? bg
      st['--funnel-surface-glass'] = rgba(lighten(bg, 0.04) ?? bg, 0.82) ?? bg
      st['--funnel-text-primary'] = readableInkOn(bg)
    }

    return st as React.CSSProperties
  }, [funnel?.customColors, funnel?.themePreset])

  // Volume discount tiers
  const subtotal = useMemo(() => {
    if (quantity === 2) return productPrice * 2 - tier2Discount
    if (quantity >= 3) return productPrice * quantity - tier3Discount
    return productPrice * quantity
  }, [productPrice, quantity, tier2Discount, tier3Discount])

  const total = subtotal + deliveryCharge

  const productCode =
    funnel?.product?.productCode ||
    funnel?.product?.sku ||
    funnel?.product?.variants?.[0]?.sku ||
    (funnel?.product?.id ? `SPL-${funnel.product.id.slice(-4).toUpperCase()}` : 'SPL-DROP')

  const effectivePixelId = funnel?.facebookPixelId || '1078121511554124'

  const waRaw = (funnel?.whatsappNumber || '01905010205').replace(/\D/g, '')
  const waTarget = waRaw.startsWith('88') ? waRaw : waRaw.startsWith('01') ? `88${waRaw}` : '8801905010205'

  const isLightMode = useMemo(() => {
    if (funnel?.themePreset === 'desert-sand') return true
    if (funnel?.themePreset === 'custom' && funnel?.customColors?.bg) {
      const hex = funnel.customColors.bg.replace('#', '')
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16)
        const g = parseInt(hex.slice(2, 4), 16)
        const b = parseInt(hex.slice(4, 6), 16)
        const brightness = (r * 299 + g * 587 + b * 114) / 1000
        return brightness > 140
      }
    }
    return false
  }, [funnel?.themePreset, funnel?.customColors?.bg])

  const brandLogoSrc = isLightMode
    ? '/images/logo/splaro-logo-black-premium.webp'
    : '/images/logo/splaro-logo-white-premium.webp'

  const preOrderWhatsappUrl = useMemo(() => {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : `https://splaro.co/funnel/drop?drop=${funnel?.slug || 'lifestyle'}`
    const msg = [
      '*SPLARO | প্রোডাক্ট অনুসন্ধান ও সরাসরি অর্ডার*',
      '━━━━━━━━━━━━━━━━━━━━',
      'হ্যালো SPLARO! আমি এই প্রোডাক্টটি সম্পর্কে জানতে ও সরাসরি অর্ডার করতে চাই:',
      '',
      `📦 *প্রোডাক্ট:* ${funnel?.product?.title || 'SPLARO Masterpiece'}`,
      `🏷️ *প্রোডাক্ট কোড:* #${productCode}`,
      `💰 *মূল্য:* ৳${productPrice.toLocaleString('en-BD')}`,
      `🔗 *প্রোডাক্ট লিংক:* ${currentUrl}`,
      '',
      'দয়া করে আমাকে বিস্তারিত জানিয়ে অর্ডারটি কনফার্ম করতে সহায়তা করুন। ধন্যবাদ!',
    ].join('\n')

    return `https://wa.me/${waTarget}?text=${encodeURIComponent(msg)}`
  }, [funnel?.slug, funnel?.product?.title, productCode, productPrice, waTarget])

  const orderConfirmationWhatsappUrl = useMemo(() => {
    if (!orderSuccess) return '#'
    const msg = [
      '*SPLARO | Order Confirmation*',
      '━━━━━━━━━━━━━━━━━━━━',
      `আমি *${orderSuccess.name}*। SPLARO-তে একটি নতুন অর্ডার করেছি এবং অর্ডারটি কনফার্ম (Confirm) করতে চাচ্ছি।`,
      '',
      '*অর্ডারের বিবরণ:*',
      `• *অর্ডার কোড:* *#${orderSuccess.invoiceNumber}*`,
      `• *গ্রাহকের নাম:* ${orderSuccess.name}`,
      `• *মোবাইল নম্বর:* ${orderSuccess.phone}`,
      `• *ডেলিভারি ঠিকানা:* ${orderSuccess.address}`,
      '',
      '*অর্ডারকৃত পণ্য:*',
      `1. *${funnel?.product?.title || 'Drop Product'}*`,
      `   • কোড: #${productCode}`,
      `   • পরিমাণ: ${quantity}টি | মূল্য: ৳${(productPrice * quantity).toLocaleString('en-BD')}`,
      '',
      '*পেমেন্ট ও বিল:*',
      '• *পেমেন্ট মেথড:* Cash on Delivery (ক্যাশ অন ডেলিভারি)',
      `• পণ্যের সাবটোটাল: ৳${subtotal.toLocaleString('en-BD')}`,
      `• ডেলিভারি চার্জ: ৳${deliveryCharge.toLocaleString('en-BD')}`,
      `• *সর্বমোট প্রদেয় বিল:* *৳${orderSuccess.total.toLocaleString('en-BD')}*`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      'দয়া করে দ্রুত অর্ডারটি কনফার্ম করে ডেলিভারির ব্যবস্থা করুন। ধন্যবাদ — *SPLARO*',
    ].join('\n')

    return `https://wa.me/${waTarget}?text=${encodeURIComponent(msg)}`
  }, [orderSuccess, funnel?.product?.title, productCode, quantity, productPrice, subtotal, deliveryCharge, waTarget])

  if (loading) {
    return (
      <div
        className="funnel-universe-root"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000000',
          color: '#ffffff',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <Image
            src="/images/logo/splaro-logo-white-premium.webp"
            alt="SPLARO"
            width={160}
            height={36}
            priority
            style={{ height: 32, width: 'auto', objectFit: 'contain' }}
          />
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: '#c084fc',
            animation: 'funnelSpin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes funnelSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (notFound || !funnel || !funnel.product) {
    return (
      <div
        className="funnel-universe-root"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000000',
          color: '#ffffff',
          padding: '32px 20px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 460, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginBottom: 28 }}>
            <Image
              src="/images/logo/splaro-logo-white-premium.webp"
              alt="SPLARO"
              width={160}
              height={36}
              priority
              style={{ height: 30, width: 'auto', objectFit: 'contain' }}
            />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 20,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              fontSize: 11.5,
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#c084fc',
              marginBottom: 16,
            }}
          >
            <span>SPLARO EXCLUSIVE DROP</span>
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 10, lineHeight: 1.3 }}>
            এই ড্রপটি বর্তমানে সক্রিয় নয়
          </h1>
          <p style={{ fontSize: 13.5, color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.6, marginBottom: 28 }}>
            এই ঠিকানায় কোনো পণ্য নির্ধারিত করা হয়নি। অ্যাডমিন প্যানেল (D2C Funnels) থেকে প্রোডাক্ট ও থিম সেট করে ড্রপটি চালু করুন, অথবা আমাদের অফিসিয়াল স্টোরে প্রবেশ করুন।
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 300 }}>
            <a
              href="https://splaro.co"
              style={{
                display: 'block',
                width: '100%',
                padding: '13px 22px',
                borderRadius: 999,
                background: '#ffffff',
                color: '#000000',
                fontWeight: 800,
                fontSize: 13.5,
                textDecoration: 'none',
              }}
            >
              অফিসিয়াল স্টোরে যান (splaro.co)
            </a>
            <a
              href="https://wa.me/8801905010205"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                padding: '12px 22px',
                borderRadius: 999,
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              <WhatsAppIcon size={18} color="#25D366" />
              <span>WhatsApp সাপোর্ট</span>
            </a>
          </div>
        </div>
      </div>
    )
  }

  /**
   * Reject the submit and take the shopper to the box that is wrong.
   *
   * The form is `noValidate`, so the browser moves nothing on its own, and the
   * message renders above a form taller than a phone screen — someone who
   * pressed the button at the bottom never saw why nothing happened. The name
   * box sits ~880px above that button, so it has to be brought to them.
   *
   * Focus first with `preventScroll`, then scroll: focusing puts the caret and
   * the phone keyboard on the box being fixed without yanking the page, and the
   * scroll that follows decides where it lands.
   *
   * The scroll is deliberately not smooth. Nothing animates on this page —
   * `scrollIntoView({ behavior: 'smooth' })` and `window.scrollTo({ behavior:
   * 'smooth' })` both leave the page where it was, while the same call without
   * `behavior` moves it — so a smooth request here would silently do nothing.
   */
  const failValidation = (field: CheckoutField, message: string) => {
    setErrorMessage(message)
    setErrorField(field)
    const target =
      field === 'name'
        ? nameRef.current
        : field === 'phone'
          ? phoneRef.current
          : field === 'email'
            ? emailRef.current
            : addressRef.current
    if (target) {
      target.focus({ preventScroll: true })
      target.scrollIntoView({ block: 'center' })
    }
  }

  /** Drop the message as soon as the shopper starts fixing that box. */
  const clearFieldError = (field: CheckoutField) => {
    if (errorField !== field) return
    setErrorField(null)
    setErrorMessage('')
  }

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    setErrorField(null)

    if (!customerName.trim()) {
      failValidation('name', 'অনুগ্রহ করে আপনার নাম লিখুন।')
      return
    }

    const cleanPhone = customerPhone.replace(/\D/g, '')
    if (cleanPhone.length < 11 || (!cleanPhone.startsWith('01') && !cleanPhone.startsWith('8801'))) {
      failValidation('phone', 'সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 01XXXXXXXXX)।')
      return
    }

    if (!shippingAddress.trim() || shippingAddress.length < 5) {
      failValidation('address', 'আপনার ডেলিভারি ঠিকানা বিস্তারিত লিখুন (বাসা/রোড/এলাকা)।')
      return
    }

    // Email is optional, so an empty box is fine — but a typo in a filled one
    // has to say so, not stop the order with nothing on screen.
    const typedEmail = customerEmail.trim()
    if (typedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(typedEmail)) {
      failValidation('email', 'ইমেইল ঠিকানাটি সঠিক নয়। ঠিক করুন অথবা ঘরটি খালি রাখুন।')
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        storeId: funnel.storeId,
        productId: funnel.product?.id ?? 'prod-1',
        variantId: selectedVariantId || undefined,
        quantity,
        customerName: customerName.trim(),
        customerPhone: cleanPhone,
        customerEmail: customerEmail.trim() || undefined,
        shippingDistrict,
        shippingAddress: shippingAddress.trim(),
        paymentMethod,
        idempotencyKey: `${idempotencyId}-${Date.now()}`,
        attribution: {
          landingPage: window.location.href,
          trafficSource: 'D2C_FUNNEL',
        },
      }

      const res = await fetch('/api/funnel/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok && data.ok) {
        setOrderSuccess({
          invoiceNumber: data.invoiceNumber,
          total: data.total,
          deliveryCharge: data.deliveryCharge,
          name: customerName,
          phone: cleanPhone,
          email: customerEmail.trim() || undefined,
          address: `${shippingAddress}, ${getDistrictBanglaName(shippingDistrict)}`,
        })

        if (typeof window !== 'undefined' && window.fbq) {
          window.fbq('track', 'Purchase', {
            value: data.total,
            currency: 'BDT',
            content_name: funnel.product?.title || 'Drop Product',
            content_ids: [funnel.product?.id || ''],
            num_items: quantity,
          })
        }
      } else {
        const rawMsg = data.message || data.error
        const msg = Array.isArray(rawMsg)
          ? rawMsg.join(', ')
          : (typeof rawMsg === 'string' ? rawMsg : 'অর্ডার প্রক্রিয়া করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।')
        setErrorMessage(msg)
      }
    } catch {
      setErrorMessage('ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।')
    } finally {
      setSubmitting(false)
    }
  }

  const themeClass = `funnel-theme--${funnel.themePreset || 'cyber-lime'}`

  return (
    <div
      className={`funnel-universe-root ${themeClass}`}
      data-theme={funnel.themePreset || 'cyber-lime'}
      style={dynamicThemeStyle}
    >
      {/* Meta / Facebook Pixel Tracking Script */}
      {effectivePixelId && (
        <>
          <Script
            id="funnel-meta-pixel"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${effectivePixelId}');
                fbq('track', 'PageView');
                fbq('track', 'ViewContent', {
                  content_name: '${(funnel.product?.title || 'Drop Product').replace(/'/g, "\\'")}',
                  content_ids: ['${funnel.product?.id || ''}'],
                  content_type: 'product',
                  value: ${productPrice},
                  currency: 'BDT'
                });
              `,
            }}
          />
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${effectivePixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}

      {/* Theatrical Overhead Cone Spotlight */}
      <div className="funnel-theatrical-spotlight" />

      {/* Elegant Architectural Geometric Matrix Grid (Clean, Evenly Spaced, Soft on Eyes) */}
      <div className="funnel-grid-backdrop" />

      {/* Ambient Futuristic Glow Orbs (Fluid Atmospheric Flow) */}
      <div
        style={{
          position: 'absolute',
          top: -80,
          left: '12%',
          width: 550,
          height: 550,
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--funnel-accent-glow) 0%, transparent 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.45,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 650,
          right: '6%',
          width: 480,
          height: 480,
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--funnel-accent-glow) 0%, transparent 70%)',
          filter: 'blur(90px)',
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.3,
        }}
      />

      {/* Main Container */}
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '18px 20px 100px', position: 'relative', zIndex: 1 }}>
        {/* Top SPLARO Brand Identity & Drop Badge */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            title="SPLARO Flagship Store"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 16px',
              borderRadius: 14,
              transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <Image
              src={brandLogoSrc}
              alt="SPLARO Luxury Fashion"
              width={220}
              height={50}
              priority
              style={{
                height: 'clamp(36px, 5.5vw, 46px)',
                width: 'auto',
                objectFit: 'contain',
                filter: 'drop-shadow(0 3px 12px rgba(0, 0, 0, 0.5))',
              }}
            />
          </Link>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              borderRadius: 30,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--funnel-border)',
              fontSize: 11.5,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#ffffff',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--funnel-accent)',
                boxShadow: '0 0 8px var(--funnel-accent)',
              }}
            />
            {funnel.storeName} · EXCLUSIVE STANDALONE DROP
          </div>
        </div>

        {/* Product Showcase Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 32,
            alignItems: 'center',
            marginBottom: 60,
          }}
        >
          {/* Main Media Showcase Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              className="funnel-media-card"
              style={{
                aspectRatio: '4/5',
                maxHeight: 580,
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 16,
                background: '#000000',
              }}
            >
              {/* Luxury Circular Zoom Button (matches user reference) */}
              {activeMediaTab === 'image' && currentImage && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsZoomOpen(true)
                  }}
                  title="ছবি জুম করুন (Pinch / Double-tap)"
                  style={{
                    position: 'absolute',
                    top: 14,
                    left: 14,
                    zIndex: 10,
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'rgba(0, 0, 0, 0.52)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1.5px solid rgba(255, 255, 255, 0.55)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
                    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                </button>
              )}

              {activeMediaTab === 'video' && videoEmbedInfo ? (
                videoEmbedInfo.type === 'video' ? (
                  <video
                    src={videoEmbedInfo.embedUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    controls
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000000' }}>
                    <iframe
                      src={videoEmbedInfo.embedUrl}
                      title={funnel.product?.title || 'Product Video Showcase'}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        border: 'none',
                      }}
                    />
                  </div>
                )
              ) : currentImage ? (
                <div
                  onClick={() => setIsZoomOpen(true)}
                  style={{ width: '100%', height: '100%', cursor: 'zoom-in', position: 'relative' }}
                  title="ছবি বড় করে দেখতে ক্লিক বা ডাবল ট্যাপ করুন"
                >
                  <Image
                    src={currentImage}
                    alt={funnel.product?.title || 'Product Image'}
                    width={800}
                    height={1000}
                    priority
                    style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--funnel-surface)',
                    color: 'var(--funnel-text-muted)',
                  }}
                >
                  No Image Available
                </div>
              )}

              {/* Video / Photo Switcher Pill (if video is available) */}
              {videoEmbedInfo && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: 4,
                    padding: '4px',
                    borderRadius: 24,
                    background: 'rgba(0, 0, 0, 0.85)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid var(--funnel-border)',
                    zIndex: 10,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveMediaTab('video')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 16,
                      border: 'none',
                      background: activeMediaTab === 'video' ? 'var(--funnel-accent)' : 'transparent',
                      color: activeMediaTab === 'video' ? '#000' : 'var(--funnel-text-primary)',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 150ms ease',
                    }}
                  >
                    <span>🎬</span>
                    <span>ভিডিও</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveMediaTab('image')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 16,
                      border: 'none',
                      background: activeMediaTab === 'image' ? 'var(--funnel-accent)' : 'transparent',
                      color: activeMediaTab === 'image' ? '#000' : 'var(--funnel-text-primary)',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 150ms ease',
                    }}
                  >
                    <span>🖼️</span>
                    <span>ছবি</span>
                  </button>
                </div>
              )}

              {/* Floating Price Pill */}
              <div
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  padding: '8px 18px',
                  borderRadius: 30,
                  background: 'rgba(0, 0, 0, 0.85)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid var(--funnel-border)',
                  fontWeight: 800,
                  fontSize: 18,
                  color: 'var(--funnel-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  zIndex: 9,
                }}
              >
                {funnel.product?.compareAtPrice && funnel.product.compareAtPrice > productPrice && (
                  <span
                    style={{
                      fontSize: 14,
                      textDecoration: 'line-through',
                      color: 'var(--funnel-text-muted)',
                      fontWeight: 600,
                    }}
                  >
                    ৳{funnel.product.compareAtPrice.toLocaleString('en-BD')}
                  </span>
                )}
                <span>৳{productPrice.toLocaleString('en-BD')}</span>
              </div>
            </div>

            {/* Product Photo Thumbnails (when viewing images) */}
            {activeMediaTab === 'image' && (funnel.product?.images?.length ?? 0) > 1 && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {funnel.product?.images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImageIdx(idx)}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: selectedImageIdx === idx ? '2px solid var(--funnel-accent)' : '1px solid var(--funnel-border)',
                      padding: 0,
                      background: '#000',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Story & Highlights inside Frosted Liquid Glass Coating */}
          <div
            className="funnel-round-flow-card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              padding: 'clamp(20px, 3.5vw, 32px)',
              background: 'var(--funnel-surface-glass)',
              backdropFilter: 'blur(36px)',
              WebkitBackdropFilter: 'blur(36px)',
              border: '1px solid var(--funnel-border)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45), inset 0 1px 1.5px rgba(255, 255, 255, 0.25)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--funnel-accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {funnel.heroBadgeText || 'Featured Drop Product'}
                </div>
                {productCode && (
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 20,
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid var(--funnel-border)',
                      fontSize: 12,
                      fontWeight: 800,
                      color: 'var(--funnel-text-primary)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    🏷️ কোড: #{productCode}
                  </span>
                )}
              </div>
              {/* The product name is what this page is about — h1, not h2. The
                  only other h1 lives in the unconfigured branch below, which
                  never renders alongside this one. */}
              <h1 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.25rem)', fontWeight: 800, margin: '8px 0 10px', color: 'var(--funnel-text-primary)' }}>
                {funnel.product?.title}
              </h1>
              {funnel.reviewRatingText && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 20,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--funnel-border)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--funnel-accent)',
                    marginBottom: 10,
                  }}
                >
                  <span>{funnel.reviewRatingText}</span>
                </div>
              )}
              <p style={{ fontSize: 16, color: '#ffffff', lineHeight: 1.75, margin: 0, fontWeight: 700 }}>
                {funnel.product?.description}
              </p>
            </div>

            {/* Bullet Highlights */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(funnel.bulletPoints ?? []).map((bullet, idx) => (
                <div
                  key={idx}
                  className="funnel-glass-card"
                  style={{
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#ffffff',
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: 'var(--funnel-accent)',
                      color: '#000000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>
                  <span>{bullet}</span>
                </div>
              ))}
            </div>

            {/* Scroll Down to Form CTA */}
            <div className="funnel-btn-luminous-wrap" style={{ width: '100%', marginTop: 8 }}>
              <a
                href="#order-section"
                className="funnel-btn-luminous-inner"
                style={{ textDecoration: 'none', textAlign: 'center' }}
              >
                {/* Deliberately not funnel.ctaText: that is the submit button's
                    label ("অর্ডার কনফার্ম করুন…"), and printing it here gave the
                    page two identical buttons doing different things — this one
                    only scrolls to the form. */}
                ⚡ অর্ডার করতে নিচে যান
              </a>
            </div>
          </div>
        </div>

        {/* 1-PAGE EXPRESS CHECKOUT FORM SECTION */}
        <div id="order-section" style={{ maxWidth: 720, margin: '0 auto' }}>
          {orderSuccess ? (
            /* Celebratory Confirmation Screen */
            <div
              className="funnel-round-flow-card"
              style={{
                padding: 'clamp(28px, 5vw, 48px)',
                textAlign: 'center',
                border: '2px solid var(--funnel-accent)',
                boxShadow: '0 0 50px var(--funnel-accent-glow)',
              }}
            >
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  background: 'var(--funnel-accent)',
                  color: '#000000',
                  fontSize: 32,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                }}
              >
                ✓
              </div>

              <h2 style={{ fontSize: 26, fontWeight: 900, margin: '0 0 10px', color: 'var(--funnel-text-primary)' }}>
                অভিনন্দন! আপনার অর্ডারটি সফল হয়েছে!
              </h2>

              <p style={{ fontSize: 16, color: 'var(--funnel-text-muted)', margin: '0 0 24px' }}>
                আমাদের প্রতিনিধি শীঘ্রই আপনার সাথে ফোনে যোগাযোগ করে অর্ডার কনফার্ম করবেন।
              </p>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: 12,
                  padding: 20,
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  fontSize: 14,
                  marginBottom: 24,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--funnel-text-muted)' }}>ইনভয়েস নম্বর:</span>
                  <strong style={{ color: 'var(--funnel-accent)' }}>{orderSuccess.invoiceNumber}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--funnel-text-muted)' }}>অর্ডারকৃত পণ্য:</span>
                  <strong style={{ color: 'var(--funnel-text-primary)' }}>
                    {funnel.product?.title || 'Drop Product'} (#{productCode})
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--funnel-text-muted)' }}>গ্রাহকের নাম:</span>
                  <span>{orderSuccess.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--funnel-text-muted)' }}>মোবাইল নম্বর:</span>
                  <span>{orderSuccess.phone}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--funnel-text-muted)' }}>ঠিকানা:</span>
                  <span>{orderSuccess.address}</span>
                </div>
                {orderSuccess.email && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--funnel-text-muted)' }}>ইমেইল:</span>
                    <span>{orderSuccess.email}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--funnel-border)', paddingTop: 10 }}>
                  <span style={{ fontWeight: 700 }}>সর্বমোট প্রদেয় বিল (ক্যাশ অন ডেলিভারি):</span>
                  <strong style={{ fontSize: 18, color: 'var(--funnel-accent)' }}>
                    ৳{orderSuccess.total.toLocaleString('en-BD')}
                  </strong>
                </div>
                {orderSuccess.email && (
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 12,
                      color: 'var(--funnel-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 6,
                    }}
                  >
                    <span>📧</span>
                    <span>
                      ইনভয়েসের অফিসিয়াল ডিজিটাল কপি আপনার ইমেইলে (<strong>{orderSuccess.email}</strong>) পাঠানো হয়েছে।
                    </span>
                  </div>
                )}
              </div>

              {/* SPLARO Luxury WhatsApp Confirmation Card */}
              <div
                style={{
                  background: 'rgba(37, 211, 102, 0.08)',
                  border: '1px solid rgba(37, 211, 102, 0.35)',
                  borderRadius: 12,
                  padding: 20,
                  textAlign: 'center',
                  marginBottom: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
                    দ্রুত নিশ্চিত করতে WhatsApp-এ মেসেজ পাঠান
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.7)', marginTop: 4 }}>
                    অর্ডারের সকল তথ্য মেসেজে সাজানো রয়েছে। নিচের বাটনে ক্লিক করে WhatsApp-এ Send চাপুন।
                  </div>
                </div>

                <a
                  href={orderConfirmationWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    padding: '14px 24px',
                    borderRadius: 30,
                    background: '#25D366',
                    color: '#000000',
                    fontWeight: 900,
                    fontSize: 15,
                    textDecoration: 'none',
                    boxShadow: '0 6px 20px rgba(37, 211, 102, 0.4)',
                    cursor: 'pointer',
                  }}
                >
                  <WhatsAppIcon size={20} color="#000000" />
                  <span>Confirm via WhatsApp (মেসেজ পাঠান)</span>
                </a>
              </div>

              <button
                type="button"
                onClick={() => setOrderSuccess(null)}
                className="funnel-btn-primary"
                style={{ width: '100%' }}
              >
                আরেকটি নতুন অর্ডার করুন
              </button>
            </div>
          ) : (
            /* The Express Checkout Form */
            <div className="funnel-round-flow-card" style={{ padding: 'clamp(24px, 4.5vw, 40px)' }}>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--funnel-accent)',
                  }}
                >
                  Frictionless 1-Page Checkout
                </span>
                <h3 style={{ fontSize: 24, fontWeight: 900, margin: '6px 0 0', color: 'var(--funnel-text-primary)' }}>
                  অর্ডার করতে নিচের ফর্মটি পূরণ করুন
                </h3>
                <p style={{ fontSize: 13, color: 'var(--funnel-text-muted)', margin: '4px 0 0' }}>
                  কোনো পাসওয়ার্ড বা লগইন প্রয়োজন নেই · সরাসরি ক্যাশ অন ডেলিভারি
                </p>
              </div>

              {errorMessage && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    fontSize: 13,
                    marginBottom: 20,
                  }}
                >
                  ⚠️ {errorMessage}
                </div>
              )}

              {/* noValidate on purpose: the browser's own bubble is easy to miss
                  on a phone — a half-typed email just made the button look
                  dead. Every field is checked below with a message the shopper
                  can actually read. */}
              <form
                noValidate
                onSubmit={handleOrderSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
              >
                {/* Quantity Package Selector */}
                <div>
                  <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 8 }}>
                    প্যাকেজ / পরিমাণ বেছে নিন:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {[
                      { qty: 1, label: '১ টি নিন', tag: funnel.bundleTier1Tag || 'নরমাল' },
                      { qty: 2, label: '২ টি নিন', tag: funnel.bundleTier2Tag || `৳${tier2Discount} ছাড়!` },
                      { qty: 3, label: '৩ টি নিন', tag: funnel.bundleTier3Tag || `৳${tier3Discount} ছাড়!` },
                    ].map((pkg) => {
                      const isSelected = quantity === pkg.qty
                      return (
                        <div
                          key={pkg.qty}
                          onClick={() => setQuantity(pkg.qty)}
                          style={{
                            padding: '12px 8px',
                            borderRadius: 10,
                            border: isSelected ? '2px solid var(--funnel-accent)' : '1px solid var(--funnel-border)',
                            background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'border-color 150ms ease',
                          }}
                        >
                          <div style={{ fontWeight: 800, fontSize: 14 }}>{pkg.label}</div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: isSelected ? 'var(--funnel-accent)' : 'var(--funnel-text-muted)',
                              marginTop: 2,
                              display: 'block',
                            }}
                          >
                            {pkg.tag}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Variant / Size Selector */}
                {funnel.product?.variants && funnel.product.variants.length > 0 && (
                  <div>
                    <label style={{ fontSize: 14, fontWeight: 800, display: 'block', marginBottom: 10, color: '#ffffff' }}>
                      সাইজ / ভ্যারিয়েন্ট বেছে নিন:
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {funnel.product.variants.map((v) => {
                        const isSelected = selectedVariantId === v.id
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setSelectedVariantId(v.id)}
                            style={{
                              padding: '10px 20px',
                              borderRadius: 30,
                              border: isSelected
                                ? '2px solid var(--funnel-accent)'
                                : '1px solid rgba(255, 255, 255, 0.18)',
                              background: isSelected
                                ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.08) 100%)'
                                : 'rgba(255, 255, 255, 0.04)',
                              color: '#ffffff',
                              fontWeight: isSelected ? 800 : 600,
                              fontSize: 13.5,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              backdropFilter: 'blur(16px)',
                              WebkitBackdropFilter: 'blur(16px)',
                              boxShadow: isSelected
                                ? '0 0 16px var(--funnel-accent-glow), inset 0 1px 1px rgba(255, 255, 255, 0.4)'
                                : 'none',
                              transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                            }}
                          >
                            {isSelected && (
                              <span
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: '50%',
                                  background: 'var(--funnel-accent)',
                                  color: '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 11,
                                  fontWeight: 900,
                                }}
                              >
                                ✓
                              </span>
                            )}
                            <span>{v.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Customer Name */}
                <div>
                  <label style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', display: 'block', marginBottom: 6 }}>
                    আপনার সম্পূর্ণ নাম *
                  </label>
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    autoCapitalize="words"
                    enterKeyHint="next"
                    required
                    placeholder="আপনার নাম লিখুন"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value)
                      clearFieldError('name')
                    }}
                    ref={nameRef}
                    aria-invalid={errorField === 'name'}
                    aria-describedby={errorField === 'name' ? 'funnel-err-name' : undefined}
                    className="funnel-input"
                  />
                  {errorField === 'name' && <FieldError id="funnel-err-name">{errorMessage}</FieldError>}
                </div>

                {/* Customer Phone — inputMode numeric, not tel: a BD mobile is
                    eleven digits and nothing else, so the phone pad's + and ( )
                    are keys that can only produce a rejected number. */}
                <div>
                  <label style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', display: 'block', marginBottom: 6 }}>
                    মোবাইল নম্বর * (কুরিয়ারের জন্য আবশ্যক)
                  </label>
                  <input
                    type="tel"
                    name="tel"
                    autoComplete="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={14}
                    enterKeyHint="next"
                    required
                    placeholder="01XXXXXXXXX"
                    value={customerPhone}
                    onChange={(e) => {
                      setCustomerPhone(e.target.value)
                      clearFieldError('phone')
                    }}
                    ref={phoneRef}
                    aria-invalid={errorField === 'phone'}
                    aria-describedby={errorField === 'phone' ? 'funnel-err-phone' : undefined}
                    className="funnel-input"
                  />
                  {errorField === 'phone' && <FieldError id="funnel-err-phone">{errorMessage}</FieldError>}
                </div>

                {/* Customer Email (Optional) */}
                <div>
                  <label style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', display: 'block', marginBottom: 6 }}>
                    ইমেইল অ্যাড্রেস <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--funnel-text-muted)' }}>(ঐচ্ছিক - ইনভয়েস পেতে)</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="next"
                    placeholder="আপনার ইমেইল দিন (যদি থাকে)"
                    value={customerEmail}
                    onChange={(e) => {
                      setCustomerEmail(e.target.value)
                      clearFieldError('email')
                    }}
                    ref={emailRef}
                    aria-invalid={errorField === 'email'}
                    aria-describedby={errorField === 'email' ? 'funnel-err-email' : undefined}
                    className="funnel-input"
                  />
                  {errorField === 'email' && <FieldError id="funnel-err-email">{errorMessage}</FieldError>}
                </div>

                {/* District Selector */}
                <div>
                  <label style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', display: 'block', marginBottom: 6 }}>
                    আপনার জেলা / এরিয়া *
                  </label>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <select
                      name="address-level2"
                      autoComplete="address-level2"
                      value={shippingDistrict}
                      onChange={(e) => setShippingDistrict(e.target.value)}
                      className="funnel-input funnel-select-district"
                      style={{ cursor: 'pointer' }}
                    >
                      {BD_DISTRICT_LIST.map((dist) => (
                        <option key={dist.en} value={dist.en}>
                          {dist.bn}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Delivery Address */}
                <div>
                  <label style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', display: 'block', marginBottom: 6 }}>
                    সম্পূর্ণ ডেলিভারি ঠিকানা *
                  </label>
                  <textarea
                    name="street-address"
                    autoComplete="street-address"
                    enterKeyHint="done"
                    required
                    rows={2}
                    placeholder="বাসা নম্বর, রোড নম্বর, এলাকা বা থানার নাম লিখুন"
                    value={shippingAddress}
                    onChange={(e) => {
                      setShippingAddress(e.target.value)
                      clearFieldError('address')
                    }}
                    ref={addressRef}
                    aria-invalid={errorField === 'address'}
                    aria-describedby={errorField === 'address' ? 'funnel-err-address' : undefined}
                    className="funnel-input"
                    style={{ resize: 'vertical' }}
                  />
                  {errorField === 'address' && <FieldError id="funnel-err-address">{errorMessage}</FieldError>}
                </div>

                {/* Delivery Timeline Notice */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--funnel-border)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--funnel-text-muted)',
                  }}
                >
                  {!hasLeadingEmoji(funnel.deliveryTimelineText) && (
                    <span style={{ fontSize: 16 }}>⚡</span>
                  )}
                  <span>{funnel.deliveryTimelineText || 'ঢাকা সিটিতে ২৪-৪৮ ঘণ্টা, ঢাকার বাইরে ২-৩ দিনে নিশ্চিত হোম ডেলিভারি'}</span>
                </div>

                {/* Live Bill Summary */}
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: 10,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    fontSize: 14,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--funnel-text-muted)' }}>
                    <span>সাবটোটাল ({quantity} টি আইটেম):</span>
                    <span>৳{subtotal.toLocaleString('en-BD')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--funnel-text-muted)' }}>
                    <span>ডেলিভারি চার্জ ({isDhaka ? 'ঢাকা' : 'ঢাকার বাইরে'}):</span>
                    <span>৳{deliveryCharge.toLocaleString('en-BD')}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderTop: '1px solid var(--funnel-border)',
                      paddingTop: 10,
                      fontWeight: 800,
                      fontSize: 17,
                    }}
                  >
                    <span>সর্বমোট প্রদেয় বিল:</span>
                    <span style={{ color: 'var(--funnel-accent)' }}>
                      ৳{total.toLocaleString('en-BD')}
                    </span>
                  </div>
                </div>

                {/* Payment Option */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <div
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 8,
                      border: '2px solid var(--funnel-accent)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      textAlign: 'center',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    💵 ক্যাশ অন ডেলিভারি (পণ্য হাতে পেয়ে মূল্য পরিশোধ)
                  </div>
                </div>

                {/* Urgency Badge if configured */}
                {funnel.urgencyText && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '8px 14px',
                      borderRadius: 8,
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#f87171',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    <span>{funnel.urgencyText}</span>
                  </div>
                )}

                {/* Submit Order Button with Luminous Border Beam */}
                <div className="funnel-btn-luminous-wrap" style={{ width: '100%' }}>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="funnel-btn-luminous-inner"
                    style={{
                      padding: 18,
                      fontSize: 17,
                      fontWeight: 900,
                      opacity: submitting ? 0.7 : 1,
                    }}
                  >
                    {submitting ? 'অর্ডার প্রসেস হচ্ছে...' : (funnel.ctaText || 'অর্ডার কনফার্ম করুন (ক্যাশ অন ডেলিভারি)')}
                  </button>
                </div>

                {/* Guarantee Badge if configured */}
                {funnel.guaranteeBadge && (
                  <div
                    style={{
                      textAlign: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--funnel-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    {!hasLeadingEmoji(funnel.guaranteeBadge) && <span>🛡️</span>}
                    <span>{funnel.guaranteeBadge}</span>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>

        {/* Subtle Brand Identity Footer with Frosted Liquid Glass Prolep */}
        <div style={{ textAlign: 'center', marginTop: 44, paddingBottom: 28 }}>
          <div
            className="funnel-round-flow-card"
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '16px 28px',
              borderRadius: 24,
              background: 'var(--funnel-surface-glass)',
              backdropFilter: 'blur(36px)',
              WebkitBackdropFilter: 'blur(36px)',
              border: '1px solid var(--funnel-border)',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55)',
            }}
          >
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              title="SPLARO Official"
              style={{ display: 'inline-block' }}
            >
              <Image
                src={brandLogoSrc}
                alt="SPLARO"
                width={100}
                height={26}
                style={{ height: 22, width: 'auto', objectFit: 'contain' }}
              />
            </Link>
            <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.85)', fontWeight: 600 }}>
              © {new Date().getFullYear()} SPLARO. All rights reserved.
            </div>
          </div>
        </div>
      </div>

      {/* Floating Luxury WhatsApp Widget with Pre-filled Product Details */}
      <a
        href={preOrderWhatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="WhatsApp-এ সরাসরি অর্ডার করুন"
        aria-label="WhatsApp-এ সরাসরি অর্ডার করুন"
        className="fd-whatsapp-fab"
      >
        <WhatsAppIcon size={22} color="#ffffff" />
      </a>

      {/* Sticky Mobile Buy Bar */}
      <div className="funnel-sticky-bar">
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
            {funnel.product?.title?.slice(0, 20)}... <span style={{ opacity: 0.6, fontSize: 11 }}>#{productCode}</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            <span style={{ color: 'var(--funnel-accent)', marginRight: 2 }}>৳</span>{productPrice.toLocaleString('en-BD')}
          </div>
        </div>

        <div className="funnel-btn-luminous-wrap">
          <a
            href="#order-section"
            className="funnel-btn-luminous-inner"
            style={{ textDecoration: 'none', padding: '10px 22px', fontSize: 13 }}
          >
            অর্ডার করুন
          </a>
        </div>
      </div>

      {/* Fullscreen Interactive Zoom Lightbox Modal */}
      <FunnelImageZoomModal
        isOpen={isZoomOpen}
        onClose={() => setIsZoomOpen(false)}
        images={funnel.product?.images && funnel.product.images.length > 0 ? funnel.product.images : [currentImage || '']}
        initialIdx={selectedImageIdx}
        productTitle={funnel.product?.title}
        productCode={productCode}
      />
    </div>
  )
}
