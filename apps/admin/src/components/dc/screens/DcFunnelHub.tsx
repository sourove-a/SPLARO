'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useSettings } from '@/lib/api/hooks'
import { apiFetch } from '@/lib/api/client'
import { toastOk, toastFail } from '@/lib/admin/feedback'
import { DcHubFrame, hubCard } from './DcHubKit'
import { DcIcon } from '@/components/dc/DcIcon'
import { funnelStorefrontUrl } from '@/lib/admin/funnel-storefront-url'
import { formatTaka } from '@/components/dc/tokens'

interface FunnelUniverseSummary {
  id: string
  name: string
  slug: string
  domain?: string | null
  subdomain?: string | null
  isActive: boolean
  themePreset: string
  themeName?: string | null
  customColors?: Record<string, string> | null
  activeProductId?: string | null
  headline?: string | null
  subheadline?: string | null
  heroMediaUrl?: string | null
  heroMediaType?: 'image' | 'video'
  bulletPoints?: string[]
  bundles?: Array<{ qty: number; label: string; price: number; badge?: string }>
  ctaText?: string | null
  urgencyText?: string | null
  guaranteeBadge?: string | null
  whatsappNumber?: string | null
  videoUrl?: string | null
  productLanguage?: 'bn' | 'en' | null
  customProductTitle?: string | null
  customProductDescription?: string | null
  customProductPrice?: number | null
  customCompareAtPrice?: number | null
  heroBadgeText?: string | null
  reviewRatingText?: string | null
  deliveryTimelineText?: string | null
  bundleTier2Discount?: number | null
  bundleTier3Discount?: number | null
  bundleTier1Tag?: string | null
  bundleTier2Tag?: string | null
  bundleTier3Tag?: string | null
  bundleTier1Title?: string | null
  bundleTier2Title?: string | null
  bundleTier3Title?: string | null
  showBundleCards?: boolean
  deliveryInsideDhaka?: number
  deliveryOutsideDhaka?: number
  ordersCount: number
  productsCount: number
  facebookPixelId?: string | null
  tiktokPixelId?: string | null
}

interface ProductOption {
  id: string
  name: string
  description?: string | null
  schemaMarkup?: {
    nameBn?: string
    descriptionBn?: string
    [key: string]: unknown
  } | null
  basePrice: number | string
  compareAtPrice?: number | string | null
  status: string
  sku?: string | null
  productCode?: string | null
  images?: Array<{ url: string }>
  variants?: Array<{ id?: string; stock?: number; sku?: string; size?: string; color?: string; colorName?: string }>
}

interface ThemePreset {
  id: string
  name: string
  accentHex: string
  bgHex: string
  desc: string
}

const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'imperial-purple',
    name: 'Imperial Violet Matrix (8K Line Grid)',
    accentHex: '#c084fc',
    bgHex: '#000000',
    desc: 'Pitch-black fading into radiant violet glow with clean geometric line grid (8K Minimalist Luxury)',
  },
  {
    id: 'crimson-matrix',
    name: 'Crimson Cyber Matrix (8K Line Grid)',
    accentHex: '#ff2a4b',
    bgHex: '#000000',
    desc: 'Pitch-black fading into radiant crimson glow with clean geometric line grid (8K Minimalist Luxury)',
  },
  {
    id: 'cobalt-sapphire',
    name: 'Electric Cobalt & Cyber Ice',
    accentHex: '#38bdf8',
    bgHex: '#040e34',
    desc: 'Ledgr robotic royal blue with frosted crystalline glass and luminous cyber light border',
  },
  {
    id: 'cyber-lime',
    name: 'Cyber Lime Matrix (8K Line Grid)',
    accentHex: '#b5f527',
    bgHex: '#000000',
    desc: 'Pitch-black fading into radiant emerald-lime glow with clean geometric line grid (8K Minimalist Luxury)',
  },
  {
    id: 'obsidian-gold',
    name: 'Obsidian & Champagne Gold',
    accentHex: '#d4af37',
    bgHex: '#0b0c0e',
    desc: 'High horology aesthetics with brushed champagne gold and obsidian slate',
  },
  {
    id: 'emerald-velvet',
    name: 'Midnight Emerald Velvet',
    accentHex: '#10b981',
    bgHex: '#05120d',
    desc: 'Royal heritage velvet green with luminous emerald accents',
  },
  {
    id: 'titanium-silver',
    name: 'Titanium Precision Silver',
    accentHex: '#e2e8f0',
    bgHex: '#0d0f12',
    desc: 'Apple minimalist matte titanium with cool icy reflections',
  },
  {
    id: 'warm-sand',
    name: 'Warm Mediterranean Sand',
    accentHex: '#d49a6a',
    bgHex: '#14110f',
    desc: 'Tuscan sun earth tones for artisanal leather, linen, and heritage goods',
  },
  {
    id: 'custom',
    name: 'Custom Signature Theme',
    accentHex: '#b5f527',
    bgHex: '#000000',
    desc: 'Bespoke atmosphere with custom theme name, custom hex accent, and dark backdrop',
  },
]

function resolveVideoEmbed(rawUrl?: string | null): { type: 'youtube' | 'vimeo' | 'video'; embedUrl: string } | null {
  if (!rawUrl || !rawUrl.trim()) return null
  const url = rawUrl.trim()

  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/)
  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1]
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&controls=1&rel=0`,
    }
  }

  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/)
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      type: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=0`,
    }
  }

  return {
    type: 'video',
    embedUrl: url,
  }
}

const DEFAULT_BULLETS_BN = [
  'হস্তনির্মিত রাজকীয় কারুকার্য ও নিখুঁত ফিনিশিং',
  'প্রিমিয়াম আন্তর্জাতিক কোয়ালিটি ফ্যাব্রিক ও দীর্ঘস্থায়ী স্থায়িত্ব',
  '১ বছরের সম্পূর্ণ রিপ্লেসমেন্ট এবং কোয়ালিটি গ্যারান্টি',
  'সারা বাংলাদেশে ক্যাশ অন ডেলিভারি (পণ্য হাতে পেয়ে টাকা পরিশোধ)',
]

const DEFAULT_BULLETS_EN = [
  'Handcrafted Bespoke Craftsmanship & Prestige Finish',
  'Military-Grade Durability & Supreme Comfort Fit',
  'Full 1-Year Comprehensive Replacement Warranty',
  'Fast Cash on Delivery Across Bangladesh (1-3 Days)',
]

export function DcFunnelHub() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: globalSettings } = useSettings()
  const masterPixel = globalSettings?.marketing?.facebookPixelId?.trim() || ''

  // Navigation View Mode: 'LIST' | 'EDITOR'
  const [viewMode, setViewMode] = useState<'LIST' | 'EDITOR'>('LIST')
  const [editingUniverseId, setEditingUniverseId] = useState<string | null>(null)

  // Form State - Identity & Domain
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [domain, setDomain] = useState('')

  // Form State - Theme Customization (Name, Preset, Colors, Desc)
  const [themePreset, setThemePreset] = useState('obsidian-gold')
  const [themeName, setThemeName] = useState('Obsidian & Champagne Gold')
  const [themeDescription, setThemeDescription] = useState('High horology aesthetics with brushed champagne gold and obsidian slate')
  const [themeAccentColor, setThemeAccentColor] = useState('#d4af37')
  const [themeBgColor, setThemeBgColor] = useState('#0b0c0e')

  // Form State - Attached Product
  const [activeProductId, setActiveProductId] = useState('')

  // Form State - Language & Custom Product Display
  const [productLanguage, setProductLanguage] = useState<'bn' | 'en'>('bn')
  const [customProductTitle, setCustomProductTitle] = useState('')
  const [customProductDescription, setCustomProductDescription] = useState('')
  const [customProductPrice, setCustomProductPrice] = useState('')
  const [customCompareAtPrice, setCustomCompareAtPrice] = useState('')

  // Form State - Marketing Copy, Badges & Urgency
  const [headline, setHeadline] = useState('STEP OUT OF THE ORDINARY')
  const [subheadline, setSubheadline] = useState('Limited Edition Masterpiece Drop · Only 100 Pieces')
  const [heroBadgeText, setHeroBadgeText] = useState('✨ স্পেশাল লিমিটেড ড্রপ')
  const [reviewRatingText, setReviewRatingText] = useState('⭐⭐⭐⭐⭐ ৪.৯/৫ (২৪০+ ভেরিফাইড রিভিউ) · ৯৯% সন্তুষ্টি')
  const [ctaText, setCtaText] = useState('অর্ডার কনফার্ম করুন (ক্যাশ অন ডেলিভারি)')
  const [urgencyText, setUrgencyText] = useState('🔥 মাত্র ৫টি পিস স্টকে বাকি আছে · দ্রুত অর্ডার করুন')
  const [guaranteeBadge, setGuaranteeBadge] = useState('🛡️ ১০০% অরিজিনাল কোয়ালিটি গ্যারান্টি · ৩ দিনের সহজ রিটার্ন')

  // Form State - Package Bundles & Discounts
  const [showBundleCards, setShowBundleCards] = useState<boolean>(true)
  const [bundleTier1Title, setBundleTier1Title] = useState('১ টি নিন')
  const [bundleTier2Title, setBundleTier2Title] = useState('২ টি নিন')
  const [bundleTier3Title, setBundleTier3Title] = useState('৩ টি নিন')
  const [bundleTier2Discount, setBundleTier2Discount] = useState<number>(200)
  const [bundleTier3Discount, setBundleTier3Discount] = useState<number>(450)
  const [bundleTier1Tag, setBundleTier1Tag] = useState('রেগুলার প্রাইস')
  const [bundleTier2Tag, setBundleTier2Tag] = useState('৳২০০ ছাড়!')
  const [bundleTier3Tag, setBundleTier3Tag] = useState('৳৪৫০ ছাড়!')

  // Form State - Feature Bullets
  const [bulletPoints, setBulletPoints] = useState<string[]>(DEFAULT_BULLETS_BN)
  const [newBullet, setNewBullet] = useState('')

  // Form State - Delivery Matrix & Timeline & Support
  const [deliveryInsideDhaka, setDeliveryInsideDhaka] = useState<number>(70)
  const [deliveryOutsideDhaka, setDeliveryOutsideDhaka] = useState<number>(130)
  const [deliveryTimelineText, setDeliveryTimelineText] = useState('🚚 ঢাকা সিটিতে ২৪-৪৮ ঘণ্টা, ঢাকার বাইরে ২-৩ দিনে ক্যাশ অন হোম ডেলিভারি')
  const [whatsappNumber, setWhatsappNumber] = useState('01905010205')

  // Form State - Media
  const [heroMediaType, setHeroMediaType] = useState<'image' | 'video'>('image')
  const [videoUrl, setVideoUrl] = useState('')

  // Form State - Tracking Pixels (Leave empty to inherit global backend pixel)
  const [facebookPixelId, setFacebookPixelId] = useState('')
  const [tiktokPixelId, setTiktokPixelId] = useState('')

  // Search filter for products in editor
  const [productSearch, setProductSearch] = useState('')

  // 1. Fetch Funnel Universes
  const funnelsQuery = useQuery({
    queryKey: ['admin-funnels'],
    queryFn: () => apiFetch<FunnelUniverseSummary[]>('/admin/funnels'),
  })

  // 2. Fetch Catalog Products
  const productsQuery = useQuery({
    queryKey: ['admin-products-picker'],
    queryFn: async () => {
      const res = await apiFetch<{ products?: ProductOption[]; items?: ProductOption[]; data?: ProductOption[] }>(
        '/admin/products?limit=100',
      )
      return res.products ?? res.items ?? res.data ?? []
    },
  })

  // 3. Create / Launch Funnel Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      return apiFetch('/admin/funnels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      toastOk('Funnel Universe successfully launched!')
      setViewMode('LIST')
      resetForm()
      void queryClient.invalidateQueries({ queryKey: ['admin-funnels'] })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to launch funnel'
      toastFail(msg)
    },
  })

  // 4. Update Funnel Mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string
      payload: Record<string, unknown>
    }) => {
      return apiFetch(`/admin/funnels/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      toastOk('Funnel Universe successfully updated!')
      setViewMode('LIST')
      resetForm()
      void queryClient.invalidateQueries({ queryKey: ['admin-funnels'] })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update funnel'
      toastFail(msg)
    },
  })

  // 5. Delete Funnel Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/admin/funnels/${id}`, {
        method: 'DELETE',
      })
    },
    onSuccess: () => {
      toastOk('Funnel Universe deleted successfully')
      void queryClient.invalidateQueries({ queryKey: ['admin-funnels'] })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to delete funnel'
      toastFail(msg)
    },
  })

  const funnels = useMemo(() => funnelsQuery.data ?? [], [funnelsQuery.data])
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data])

  // Filter products by search term
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products
    const s = productSearch.toLowerCase()
    return products.filter((p) => {
      const nameMatch = p.name.toLowerCase().includes(s)
      const bnMatch = p.schemaMarkup?.nameBn ? p.schemaMarkup.nameBn.toLowerCase().includes(s) : false
      return nameMatch || bnMatch
    })
  }, [products, productSearch])

  // Active product details
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === activeProductId),
    [products, activeProductId],
  )

  const applyLanguagePreset = (lang: 'bn' | 'en', prod?: ProductOption) => {
    setProductLanguage(lang)
    const targetProd = prod ?? selectedProduct
    if (!targetProd) return

    const schema = (targetProd.schemaMarkup && typeof targetProd.schemaMarkup === 'object' ? targetProd.schemaMarkup : {}) as Record<string, unknown>

    if (lang === 'bn') {
      const bnTitle = schema['nameBn'] ? String(schema['nameBn']) : targetProd.name
      const bnDesc = schema['descriptionBn'] ? String(schema['descriptionBn']) : (targetProd.description ?? '')
      setCustomProductTitle(bnTitle)
      setCustomProductDescription(bnDesc)
      setHeroBadgeText('✨ স্পেশাল লিমিটেড ড্রপ')
      setReviewRatingText('⭐⭐⭐⭐⭐ ৪.৯/৫ (২৪০+ ভেরিফাইড রিভিউ) · ৯৯% সন্তুষ্টি')
      setDeliveryTimelineText('🚚 ঢাকা সিটিতে ২৪-৪৮ ঘণ্টা, ঢাকার বাইরে ২-৩ দিনে ক্যাশ অন হোম ডেলিভারি')
      setBundleTier1Title('১ টি নিন')
      setBundleTier2Title('২ টি নিন')
      setBundleTier3Title('৩ টি নিন')
      setBundleTier1Tag('রেগুলার প্রাইস')
      setBundleTier2Tag('৳২০০ ছাড়!')
      setBundleTier3Tag('৳৪৫০ ছাড়!')
      setCtaText('অর্ডার কনফার্ম করুন (ক্যাশ অন ডেলিভারি)')
      setUrgencyText('🔥 মাত্র ৫টি পিস স্টকে বাকি আছে · দ্রুত অর্ডার করুন')
      setGuaranteeBadge('🛡️ ১০০% অরিজিনাল কোয়ালিটি গ্যারান্টি · ৩ দিনের সহজ রিটার্ন')
      setBulletPoints(DEFAULT_BULLETS_BN)
    } else {
      setCustomProductTitle(targetProd.name)
      setCustomProductDescription(targetProd.description ?? '')
      setHeroBadgeText('EXCLUSIVE LUXURY DROP')
      setReviewRatingText('⭐⭐⭐⭐⭐ 4.9/5 (240+ Verified Reviews) · 99% Satisfaction')
      setDeliveryTimelineText('⚡ Delivery in 24-48 Hours in Dhaka, 2-3 Days Nationwide')
      setBundleTier1Tag('Buy 1 (Regular)')
      setBundleTier2Tag('Buy 2 (Save ৳200!)')
      setBundleTier3Tag('Buy 3 (Save ৳450!)')
      setCtaText('CONFIRM ORDER (CASH ON DELIVERY)')
      setUrgencyText('🔥 Only 5 Pieces Left in Stock · Order Now')
      setGuaranteeBadge('🛡️ 100% Original Authentic Luxury · 3-Day Easy Return')
      setBulletPoints(DEFAULT_BULLETS_EN)
    }
  }

  const handleSelectProduct = (prod: ProductOption) => {
    setActiveProductId(prod.id)
    applyLanguagePreset(productLanguage, prod)
  }

  const resetForm = () => {
    setEditingUniverseId(null)
    setName('')
    setSlug('')
    setSubdomain('')
    setDomain('')
    setThemePreset('obsidian-gold')
    setThemeName('Obsidian & Champagne Gold')
    setThemeDescription('High horology aesthetics with brushed champagne gold and obsidian slate')
    setThemeAccentColor('#d4af37')
    setThemeBgColor('#0b0c0e')
    setActiveProductId('')
    setProductLanguage('bn')
    setCustomProductTitle('')
    setCustomProductDescription('')
    setCustomProductPrice('')
    setCustomCompareAtPrice('')
    setHeadline('STEP OUT OF THE ORDINARY')
    setSubheadline('Limited Edition Masterpiece Drop · Only 100 Pieces')
    setHeroBadgeText('✨ স্পেশাল লিমিটেড ড্রপ')
    setReviewRatingText('⭐⭐⭐⭐⭐ ৪.৯/৫ (২৪০+ ভেরিফাইড রিভিউ) · ৯৯% সন্তুষ্টি')
    setCtaText('অর্ডার কনফার্ম করুন (ক্যাশ অন ডেলিভারি)')
    setUrgencyText('🔥 মাত্র ৫টি পিস স্টকে বাকি আছে · দ্রুত অর্ডার করুন')
    setGuaranteeBadge('🛡️ ১০০% অরিজিনাল কোয়ালিটি গ্যারান্টি · ৩ দিনের সহজ রিটার্ন')
    setShowBundleCards(true)
    setBundleTier1Title('১ টি নিন')
    setBundleTier2Title('২ টি নিন')
    setBundleTier3Title('৩ টি নিন')
    setBundleTier2Discount(200)
    setBundleTier3Discount(450)
    setBundleTier1Tag('রেগুলার প্রাইস')
    setBundleTier2Tag('৳২০০ ছাড়!')
    setBundleTier3Tag('৳৪৫০ ছাড়!')
    setBulletPoints(DEFAULT_BULLETS_BN)
    setNewBullet('')
    setDeliveryInsideDhaka(70)
    setDeliveryOutsideDhaka(130)
    setDeliveryTimelineText('🚚 ঢাকা সিটিতে ২৪-৪৮ ঘণ্টা, ঢাকার বাইরে ২-৩ দিনে ক্যাশ অন হোম ডেলিভারি')
    setWhatsappNumber('01905010205')
    setHeroMediaType('image')
    setVideoUrl('')
    setFacebookPixelId('')
    setTiktokPixelId('')
    setProductSearch('')
  }

  const openCreateMode = () => {
    resetForm()
    if (products.length > 0) {
      const first = products[0]
      if (first) {
        setActiveProductId(first.id)
        applyLanguagePreset('bn', first)
      }
    }
    setViewMode('EDITOR')
  }

  const openEditMode = (universe: FunnelUniverseSummary) => {
    setEditingUniverseId(universe.id)
    setName(universe.name)
    setSlug(universe.slug)
    setSubdomain(universe.subdomain || '')
    setDomain(universe.domain || '')
    const matchedPreset = THEME_PRESETS.find((t) => t.id === universe.themePreset)
    setThemePreset(universe.themePreset || 'obsidian-gold')
    setThemeName(universe.themeName || matchedPreset?.name || 'Obsidian & Champagne Gold')
    setThemeDescription(matchedPreset?.desc || 'Luxury aesthetic drop theme')
    if (universe.customColors?.accent) {
      setThemeAccentColor(universe.customColors.accent)
    } else if (matchedPreset) {
      setThemeAccentColor(matchedPreset.accentHex)
    }
    if (universe.customColors?.bg) {
      setThemeBgColor(universe.customColors.bg)
    } else if (matchedPreset) {
      setThemeBgColor(matchedPreset.bgHex)
    }
    setActiveProductId(universe.activeProductId || (products[0]?.id ?? ''))
    setProductLanguage(universe.productLanguage || 'bn')
    setCustomProductTitle(universe.customProductTitle || '')
    setCustomProductDescription(universe.customProductDescription || '')
    setCustomProductPrice(universe.customProductPrice ? String(universe.customProductPrice) : '')
    setCustomCompareAtPrice(universe.customCompareAtPrice ? String(universe.customCompareAtPrice) : '')
    setHeadline(universe.headline || 'STEP OUT OF THE ORDINARY')
    setSubheadline(universe.subheadline || 'Limited Edition Masterpiece Drop · Only 100 Pieces')
    setHeroBadgeText(universe.heroBadgeText || '✨ স্পেশাল লিমিটেড ড্রপ')
    setReviewRatingText(universe.reviewRatingText || '⭐⭐⭐⭐⭐ ৪.৯/৫ (২৪০+ ভেরিফাইড রিভিউ) · ৯৯% সন্তুষ্টি')
    setCtaText(universe.ctaText || 'অর্ডার কনফার্ম করুন (ক্যাশ অন ডেলিভারি)')
    setUrgencyText(universe.urgencyText || '🔥 মাত্র ৫টি পিস স্টকে বাকি আছে · দ্রুত অর্ডার করুন')
    setGuaranteeBadge(universe.guaranteeBadge || '🛡️ ১০০% অরিজিনাল কোয়ালিটি গ্যারান্টি · ৩ দিনের সহজ রিটার্ন')
    setShowBundleCards(universe.showBundleCards !== undefined ? Boolean(universe.showBundleCards) : true)
    setBundleTier1Title(universe.bundleTier1Title || '১ টি নিন')
    setBundleTier2Title(universe.bundleTier2Title || '২ টি নিন')
    setBundleTier3Title(universe.bundleTier3Title || '৩ টি নিন')
    setBundleTier2Discount(universe.bundleTier2Discount ?? 200)
    setBundleTier3Discount(universe.bundleTier3Discount ?? 450)
    setBundleTier1Tag(universe.bundleTier1Tag || 'রেগুলার প্রাইস')
    setBundleTier2Tag(universe.bundleTier2Tag || '৳২০০ ছাড়!')
    setBundleTier3Tag(universe.bundleTier3Tag || '৳৪৫০ ছাড়!')
    setBulletPoints(universe.bulletPoints && universe.bulletPoints.length > 0 ? universe.bulletPoints : DEFAULT_BULLETS_BN)
    setDeliveryInsideDhaka(universe.deliveryInsideDhaka ?? 70)
    setDeliveryOutsideDhaka(universe.deliveryOutsideDhaka ?? 130)
    setDeliveryTimelineText(universe.deliveryTimelineText || '🚚 ঢাকা সিটিতে ২৪-৪৮ ঘণ্টা, ঢাকার বাইরে ২-৩ দিনে ক্যাশ অন হোম ডেলিভারি')
    setWhatsappNumber(universe.whatsappNumber || '01905010205')
    setHeroMediaType(universe.heroMediaType || 'image')
    setVideoUrl(universe.videoUrl || '')
    setFacebookPixelId(universe.facebookPixelId || '')
    setTiktokPixelId(universe.tiktokPixelId || '')
    setProductSearch('')
    setViewMode('EDITOR')
  }

  const handleDeleteUniverse = (universe: FunnelUniverseSummary) => {
    const ok = window.confirm(`Are you sure you want to delete "${universe.name}"?`)
    if (ok) {
      deleteMutation.mutate(universe.id)
    }
  }

  const handleAddBullet = () => {
    if (!newBullet.trim()) return
    setBulletPoints((prev) => [...prev, newBullet.trim()])
    setNewBullet('')
  }

  const handleRemoveBullet = (index: number) => {
    setBulletPoints((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toastFail('Universe name is required')
      return
    }
    if (!editingUniverseId && !slug.trim()) {
      toastFail('Universe slug is required')
      return
    }
    if (!activeProductId) {
      toastFail('Please select an active product drop')
      return
    }

    const payload = {
      name: name.trim(),
      subdomain: subdomain.trim() ? subdomain.trim().toLowerCase() : undefined,
      domain: domain.trim() ? domain.trim().toLowerCase() : undefined,
      themePreset,
      themeName: themeName.trim() || undefined,
      customColors: {
        accent: themeAccentColor,
        primary: themeAccentColor,
        bg: themeBgColor,
      },
      activeProductId,
      productLanguage,
      customProductTitle: customProductTitle.trim() || undefined,
      customProductDescription: customProductDescription.trim() || undefined,
      customProductPrice: customProductPrice ? Number(customProductPrice) : undefined,
      customCompareAtPrice: customCompareAtPrice ? Number(customCompareAtPrice) : undefined,
      headline: headline.trim() || undefined,
      subheadline: subheadline.trim() || undefined,
      heroBadgeText: heroBadgeText.trim() || undefined,
      reviewRatingText: reviewRatingText.trim() || undefined,
      ctaText: ctaText.trim() || undefined,
      urgencyText: urgencyText.trim() || undefined,
      guaranteeBadge: guaranteeBadge.trim() || undefined,
      bulletPoints,
      bundleTier2Discount: Number(bundleTier2Discount),
      bundleTier3Discount: Number(bundleTier3Discount),
      bundleTier1Tag: bundleTier1Tag.trim() || undefined,
      bundleTier2Tag: bundleTier2Tag.trim() || undefined,
      bundleTier3Tag: bundleTier3Tag.trim() || undefined,
      bundleTier1Title: bundleTier1Title.trim() || undefined,
      bundleTier2Title: bundleTier2Title.trim() || undefined,
      bundleTier3Title: bundleTier3Title.trim() || undefined,
      showBundleCards,
      deliveryInsideDhaka: Number(deliveryInsideDhaka),
      deliveryOutsideDhaka: Number(deliveryOutsideDhaka),
      deliveryTimelineText: deliveryTimelineText.trim() || undefined,
      whatsappNumber: whatsappNumber.trim() || undefined,
      heroMediaType,
      videoUrl: videoUrl.trim() || undefined,
      facebookPixelId: facebookPixelId.trim() || undefined,
      tiktokPixelId: tiktokPixelId.trim() || undefined,
    }

    if (editingUniverseId) {
      updateMutation.mutate({
        id: editingUniverseId,
        payload,
      })
    } else {
      createMutation.mutate({
        ...payload,
        slug: slug.trim().toLowerCase(),
      })
    }
  }

  const totalOrders = funnels.reduce((acc, f) => acc + (f.ordersCount || 0), 0)

  /* ──────────────────────────────────────────────────────────────────────────
     RENDER FULL-WINDOW EDITOR VIEW
     ────────────────────────────────────────────────────────────────────────── */
  if (viewMode === 'EDITOR') {
    const livePreviewUrl = funnelStorefrontUrl({ slug, subdomain, domain })

    return (
      <DcHubFrame
        crumbGroup="D2C Funnels"
        title={editingUniverseId ? `Edit Universe: ${name || 'Drop'}` : 'Launch New Funnel Universe'}
        queries={[productsQuery]}
        actions={[
          {
            label: '← Back to Universes',
            icon: 'Layers',
            variant: 'ghost',
            onClick: () => {
              setViewMode('LIST')
              resetForm()
            },
          },
        ]}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {/* Top Sticky/Responsive Action Bar */}
          <div className="dc-funnel-top-bar">
            <div className="dc-funnel-top-bar__info">
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--ink-1)' }}>
                {editingUniverseId ? 'Update Funnel Settings' : 'Configure New Drop Universe'}
              </h2>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                Full-window workspace · Standalone domain & express checkout engine
              </div>
            </div>

            <div className="dc-funnel-top-bar__actions">
              <button
                type="button"
                onClick={() => {
                  setViewMode('LIST')
                  resetForm()
                }}
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: 'transparent',
                  color: 'var(--ink-2)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <a
                href={livePreviewUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '10px 18px',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  color: 'var(--violet)',
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <DcIcon name="Eye" size={14} />
                Preview Storefront ↗
              </a>

              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                style={{
                  padding: '10px 28px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--violet-solid)',
                  color: 'var(--on-violet)',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  opacity: createMutation.isPending || updateMutation.isPending ? 0.7 : 1,
                  boxShadow: '0 4px 14px var(--violet-soft)',
                }}
              >
                <DcIcon name="Zap" size={15} />
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving Universe...'
                  : editingUniverseId
                  ? 'Save Universe Changes'
                  : 'Launch Universe Now'}
              </button>
            </div>
          </div>

          <div className="dc-funnel-editor-grid">
            {/* PRIMARY COLUMN: IDENTITY, PRODUCT & LANGUAGE, HEADLINES & REVIEWS, BULLETS */}
            <div className="dc-funnel-editor-col">
              {/* SECTION 1: IDENTITY & DOMAIN */}
              <div className="dc-funnel-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'var(--violet-soft)',
                      color: 'var(--violet)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 13,
                    }}
                  >
                    1
                  </div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink-1)' }}>
                    Universe Identity & Domain Routing
                  </h3>
                </div>

                <div className="dc-funnel-form-row-2col" style={{ marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                      Universe Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. SPLARO Lifestyle Drop"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value)
                        if (!editingUniverseId && !slug) {
                          setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'))
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink-1)',
                        fontSize: 13,
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                      Slug Identifier *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. lifestyle"
                      value={slug}
                      disabled={Boolean(editingUniverseId)}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: 8,
                        background: editingUniverseId ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--line)',
                        color: editingUniverseId ? 'var(--ink-3)' : 'var(--ink-1)',
                        fontSize: 13,
                        outline: 'none',
                        cursor: editingUniverseId ? 'not-allowed' : 'text',
                      }}
                    />
                  </div>
                </div>

                <div className="dc-funnel-form-row-2col">
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                      Subdomain on splaro.co
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="e.g. lifestyle"
                        value={subdomain}
                        onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        style={{
                          flex: 1,
                          padding: '11px 14px',
                          borderRadius: '8px 0 0 8px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--line)',
                          borderRight: 'none',
                          color: 'var(--ink-1)',
                          fontSize: 13,
                          outline: 'none',
                        }}
                      />
                      <span
                        style={{
                          padding: '11px 14px',
                          borderRadius: '0 8px 8px 0',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--line)',
                          color: 'var(--ink-3)',
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      >
                        .splaro.co
                      </span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                      OR Custom Root Domain (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. mycustomdrop.com"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value.toLowerCase().trim())}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink-1)',
                        fontSize: 13,
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: ATTACH DROP PRODUCT & LANGUAGE (বাংলা / ENGLISH) */}
              <div className="dc-funnel-card">
                <div className="dc-funnel-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: 'var(--violet-soft)',
                        color: 'var(--violet)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: 13,
                      }}
                    >
                      2
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink-1)' }}>
                        Attach Drop Product & Display Language
                      </h3>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                        Choose catalog item and select Bangla vs English display with custom override
                      </div>
                    </div>
                  </div>

                  <a
                    href="/dashboard/products/new"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--violet)',
                      textDecoration: 'none',
                    }}
                  >
                    + Add New Product to Catalog ↗
                  </a>
                </div>

                {/* Search Box */}
                <div style={{ marginBottom: 16 }}>
                  <input
                    type="text"
                    placeholder="Search catalog products (English or বাংলা)..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--line)',
                      color: 'var(--ink-1)',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Catalog Product Grid */}
                <div className="dc-funnel-product-picker-grid">
                  {filteredProducts.map((prod) => {
                    const isSelected = activeProductId === prod.id
                    const imgUrl = prod.images?.[0]?.url || '/images/hero/hero-slide-1-828.webp'
                    const bnName = prod.schemaMarkup?.nameBn

                    return (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => handleSelectProduct(prod)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: 10,
                          borderRadius: 8,
                          border: isSelected ? '2px solid var(--violet-solid)' : '1px solid var(--line)',
                          background: isSelected ? 'var(--violet-soft)' : 'var(--surface-2)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                      >
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 6,
                            overflow: 'hidden',
                            flexShrink: 0,
                            position: 'relative',
                            background: 'var(--admin-color-black)',
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imgUrl}
                            alt={prod.name}
                            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                          />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: isSelected ? 'var(--violet)' : 'var(--ink-1)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {bnName ? `${prod.name} (${bnName})` : prod.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                              {formatTaka(Number(prod.basePrice))}
                            </span>
                            {(prod.productCode || prod.sku) && (
                              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(255, 255, 255, 0.05)', color: 'var(--violet)', fontWeight: 700 }}>
                                #{prod.productCode || prod.sku}
                              </span>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: '50%',
                              background: 'var(--violet-solid)',
                              color: 'var(--on-violet)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              fontWeight: 900,
                            }}
                          >
                            ✓
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* BILINGUAL SELECTOR & OVERRIDE CONTROLS */}
                <div
                  style={{
                    padding: 18,
                    borderRadius: 10,
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>
                        Funnel Product Display Language
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                        Select whether this funnel displays in Bangla (with Hind Siliguri typography) or English
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => applyLanguagePreset('bn')}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 6,
                          border: productLanguage === 'bn' ? '2px solid var(--violet-solid)' : '1px solid var(--line)',
                          background: productLanguage === 'bn' ? 'var(--violet-soft)' : 'var(--surface-2)',
                          color: productLanguage === 'bn' ? 'var(--violet)' : 'var(--ink-2)',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span>🇧🇩</span>
                        <span>বাংলা (Bangla)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => applyLanguagePreset('en')}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 6,
                          border: productLanguage === 'en' ? '2px solid var(--violet-solid)' : '1px solid var(--line)',
                          background: productLanguage === 'en' ? 'var(--violet-soft)' : 'var(--surface-2)',
                          color: productLanguage === 'en' ? 'var(--violet)' : 'var(--ink-2)',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span>🇬🇧</span>
                        <span>English</span>
                      </button>
                    </div>
                  </div>

                  {/* Custom Product Title */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                      Product Title on Funnel (Editable)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. প্রিমিয়াম সালোয়ার স্যুট"
                      value={customProductTitle}
                      onChange={(e) => setCustomProductTitle(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink-1)',
                        fontSize: 14,
                        fontWeight: 700,
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* Custom Product Description */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                      Product Story & Highlights (Editable)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g. প্রিমিয়াম সিল্ক ফ্যাব্রিক ও আধুনিক টেইলারিং..."
                      value={customProductDescription}
                      onChange={(e) => setCustomProductDescription(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink-1)',
                        fontSize: 13,
                        outline: 'none',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  {/* Custom Price & Strikethrough Compare Price */}
                  <div className="dc-funnel-form-row-2col">
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                        Special Funnel Promo Price (৳) (Optional Override)
                      </label>
                      <input
                        type="number"
                        placeholder={selectedProduct ? String(selectedProduct.basePrice) : '3450'}
                        value={customProductPrice}
                        onChange={(e) => setCustomProductPrice(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '11px 14px',
                          borderRadius: 8,
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--line)',
                          color: 'var(--ink-1)',
                          fontSize: 13,
                          outline: 'none',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                        Compare-at / Strikethrough Price (৳) (Optional)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 4950"
                        value={customCompareAtPrice}
                        onChange={(e) => setCustomCompareAtPrice(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '11px 14px',
                          borderRadius: 8,
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--line)',
                          color: 'var(--ink-1)',
                          fontSize: 13,
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: HEADLINES, MARKETING COPY & URGENCY */}
              <div className="dc-funnel-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'var(--violet-soft)',
                      color: 'var(--violet)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 13,
                    }}
                  >
                    3
                  </div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink-1)' }}>
                    Headlines, Copy & Urgency Triggers
                  </h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                      Main Hero Headline (Massive Banner Text)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. STEP OUT OF THE ORDINARY"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink-1)',
                        fontSize: 14,
                        fontWeight: 700,
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                      Subheadline (Supporting Narrative)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Limited Edition Masterpiece Drop · Only 100 Pieces Worldwide"
                      value={subheadline}
                      onChange={(e) => setSubheadline(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink-1)',
                        fontSize: 13,
                        outline: 'none',
                        resize: 'none',
                      }}
                    />
                  </div>

                  <div className="dc-funnel-form-row-2col">
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                        Hero Top Badge / Tag
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. ✨ স্পেশাল লিমিটেড ড্রপ"
                        value={heroBadgeText}
                        onChange={(e) => setHeroBadgeText(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '11px 14px',
                          borderRadius: 8,
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--line)',
                          color: 'var(--ink-1)',
                          fontSize: 13,
                          outline: 'none',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                        Customer Review & Social Proof Text
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. ⭐⭐⭐⭐⭐ ৪.৯/৫ (২৪০+ ভেরিফাইড রিভিউ) · ৯৯% সন্তুষ্টি"
                        value={reviewRatingText}
                        onChange={(e) => setReviewRatingText(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '11px 14px',
                          borderRadius: 8,
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--line)',
                          color: 'var(--ink-1)',
                          fontSize: 13,
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  <div className="dc-funnel-form-row-2col">
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                        CTA Button Text (Express Checkout Button)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. অর্ডার কনফার্ম করুন (ক্যাশ অন ডেলিভারি)"
                        value={ctaText}
                        onChange={(e) => setCtaText(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '11px 14px',
                          borderRadius: 8,
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--line)',
                          color: 'var(--ink-1)',
                          fontSize: 13,
                          outline: 'none',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                        Urgency & Scarcity Badge Text
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 🔥 মাত্র ৫টি পিস স্টকে বাকি আছে · দ্রুত অর্ডার করুন"
                        value={urgencyText}
                        onChange={(e) => setUrgencyText(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '11px 14px',
                          borderRadius: 8,
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--line)',
                          color: 'var(--ink-1)',
                          fontSize: 13,
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                      Trust & Guarantee Badge Text
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 🛡️ ১০০% অরিজিনাল কোয়ালিটি গ্যারান্টি · ৩ দিনের সহজ রিটার্ন"
                      value={guaranteeBadge}
                      onChange={(e) => setGuaranteeBadge(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink-1)',
                        fontSize: 13,
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: PACKAGE BUNDLES & QUANTITY DISCOUNTS */}
              <div className="dc-funnel-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: 'var(--violet-soft)',
                        color: 'var(--violet)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: 13,
                      }}
                    >
                      4
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink-1)' }}>
                        Package Bundles & Quantity Discounts
                      </h3>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                        Configure volume incentive discount tiers shown on the 1-page checkout
                      </div>
                    </div>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
                    <input
                      type="checkbox"
                      checked={showBundleCards}
                      onChange={(e) => setShowBundleCards(e.target.checked)}
                      style={{ cursor: 'pointer', accentColor: 'var(--violet)' }}
                    />
                    <span>Show Bundle Cards</span>
                  </label>
                </div>

                <div className="dc-funnel-bundles-grid">
                  {/* Tier 1 */}
                  <div style={{ padding: 14, borderRadius: 8, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 8 }}>Tier 1 (Qty: 1)</div>
                    <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Title / Label</label>
                    <input
                      type="text"
                      placeholder="e.g. ১ টি নিন"
                      value={bundleTier1Title}
                      onChange={(e) => setBundleTier1Title(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink-1)',
                        fontSize: 12,
                        outline: 'none',
                        marginBottom: 8,
                      }}
                    />
                    <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Offer Badge / Subtitle</label>
                    <input
                      type="text"
                      placeholder="e.g. রেগুলার প্রাইস"
                      value={bundleTier1Tag}
                      onChange={(e) => setBundleTier1Tag(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink-1)',
                        fontSize: 12,
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* Tier 2 */}
                  <div style={{ padding: 14, borderRadius: 8, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 8 }}>Tier 2 (Qty: 2)</div>
                    <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Title / Label</label>
                    <input
                      type="text"
                      placeholder="e.g. ২ টি নিন"
                      value={bundleTier2Title}
                      onChange={(e) => setBundleTier2Title(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink-1)',
                        fontSize: 12,
                        outline: 'none',
                        marginBottom: 8,
                      }}
                    />
                    <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Discount (৳)</label>
                    <input
                      type="number"
                      value={bundleTier2Discount}
                      onChange={(e) => setBundleTier2Discount(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink-1)',
                        fontSize: 12,
                        outline: 'none',
                        marginBottom: 8,
                      }}
                    />
                    <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Offer Badge / Subtitle</label>
                    <input
                      type="text"
                      placeholder="e.g. ৳২০০ ছাড়!"
                      value={bundleTier2Tag}
                      onChange={(e) => setBundleTier2Tag(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink-1)',
                        fontSize: 12,
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* Tier 3 */}
                  <div style={{ padding: 14, borderRadius: 8, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 8 }}>Tier 3 (Qty: 3+)</div>
                    <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Title / Label</label>
                    <input
                      type="text"
                      placeholder="e.g. ৩ টি নিন"
                      value={bundleTier3Title}
                      onChange={(e) => setBundleTier3Title(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink-1)',
                        fontSize: 12,
                        outline: 'none',
                        marginBottom: 8,
                      }}
                    />
                    <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Discount (৳)</label>
                    <input
                      type="number"
                      value={bundleTier3Discount}
                      onChange={(e) => setBundleTier3Discount(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink-1)',
                        fontSize: 12,
                        outline: 'none',
                        marginBottom: 8,
                      }}
                    />
                    <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Offer Badge / Subtitle</label>
                    <input
                      type="text"
                      placeholder="e.g. ৳৪৫০ ছাড়! (জনপ্রিয়)"
                      value={bundleTier3Tag}
                      onChange={(e) => setBundleTier3Tag(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink-1)',
                        fontSize: 12,
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 5: KEY FEATURE BULLETS */}
              <div className="dc-funnel-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'var(--violet-soft)',
                      color: 'var(--violet)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 13,
                    }}
                  >
                    5
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink-1)' }}>
                      Key Feature Highlights & Bullets
                    </h3>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                      Displayed alongside the main drop media showcase
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  {bulletPoints.map((bullet, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--line)',
                      }}
                    >
                      <span style={{ fontSize: 14, color: 'var(--violet)' }}>✓</span>
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--ink-1)' }}>{bullet}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveBullet(idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--ink-3)',
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Add a new highlight bullet..."
                    value={newBullet}
                    onChange={(e) => setNewBullet(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddBullet()
                      }
                    }}
                    style={{
                      flex: '1 1 200px',
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--line)',
                      color: 'var(--ink-1)',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddBullet}
                    style={{
                      padding: '10px 18px',
                      borderRadius: 8,
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line)',
                      color: 'var(--ink-1)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    + Add Bullet
                  </button>
                </div>
              </div>
            </div>

            {/* SECONDARY COLUMN: DELIVERY MATRIX, MEDIA, THEME & PIXELS */}
            <div className="dc-funnel-editor-col">
              {/* SECTION 6: DELIVERY MATRIX & CUSTOMER SUPPORT */}
              <div className="dc-funnel-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'var(--violet-soft)',
                      color: 'var(--violet)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 13,
                    }}
                  >
                    6
                  </div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink-1)' }}>
                    Delivery Matrix & Customer Support
                  </h3>
                </div>

                {/* INHERITED DELIVERY CHARGES FROM SPLARO MAIN ADMIN */}
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: 8,
                    background: 'rgba(168, 85, 247, 0.08)',
                    border: '1px solid rgba(168, 85, 247, 0.22)',
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: 'rgba(168, 85, 247, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                      }}
                    >
                      🚚
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>
                        Delivery Rates Inherited from SPLARO Main Admin
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                        Central rates (Inside & Outside Dhaka) are synced from Main Admin Settings. No manual input needed.
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '4px 8px',
                      borderRadius: 4,
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: 'var(--emerald)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      letterSpacing: '0.5px',
                    }}
                  >
                    SYNCED
                  </span>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                    Delivery Timeline Notice Text
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 🚚 ঢাকা সিটিতে ২৪-৪৮ ঘণ্টা, ঢাকার বাইরে ২-৩ দিনে ক্যাশ অন হোম ডেলিভারি"
                    value={deliveryTimelineText}
                    onChange={(e) => setDeliveryTimelineText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: 8,
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--line)',
                      color: 'var(--ink-1)',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
                      WhatsApp Customer Support & Order Number
                    </label>
                    <span style={{ fontSize: 11, color: 'var(--violet)', fontWeight: 700 }}>
                      Official: 01905010205
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="01905010205"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: 8,
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--line)',
                      color: 'var(--ink-1)',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                    Adds a luxury 1-click WhatsApp order button with pre-filled product details, SKU code, price, and direct product link.
                  </div>
                </div>
              </div>

              {/* SECTION 7: HERO SHOWCASE MEDIA (WITH LIVE VIDEO PREVIEW) */}
              <div className="dc-funnel-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'var(--violet-soft)',
                      color: 'var(--violet)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 13,
                    }}
                  >
                    7
                  </div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink-1)' }}>
                    Hero Showcase Media & Video Embed
                  </h3>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <button
                    type="button"
                    onClick={() => setHeroMediaType('image')}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: heroMediaType === 'image' ? '2px solid var(--violet-solid)' : '1px solid var(--line)',
                      background: heroMediaType === 'image' ? 'var(--violet-soft)' : 'var(--surface-2)',
                      color: heroMediaType === 'image' ? 'var(--violet)' : 'var(--ink-2)',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    🖼️ Product Images
                  </button>

                  <button
                    type="button"
                    onClick={() => setHeroMediaType('video')}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: heroMediaType === 'video' ? '2px solid var(--violet-solid)' : '1px solid var(--line)',
                      background: heroMediaType === 'video' ? 'var(--violet-soft)' : 'var(--surface-2)',
                      color: heroMediaType === 'video' ? 'var(--violet)' : 'var(--ink-2)',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    🎬 Product Video Teaser
                  </button>
                </div>

                {heroMediaType === 'video' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                        Product Video URL (YouTube, Vimeo, or MP4)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. https://youtu.be/x6XFmB5fjZM or https://youtube.com/watch?v=..."
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '11px 14px',
                          borderRadius: 8,
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--line)',
                          color: 'var(--ink-1)',
                          fontSize: 13,
                          outline: 'none',
                        }}
                      />
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                        Supports YouTube short links (youtu.be), standard watch links, shorts, Vimeo, and direct MP4 videos
                      </div>
                    </div>

                    {/* Instant Live Video Player Preview in Admin */}
                    {(() => {
                      const videoEmbed = resolveVideoEmbed(videoUrl)
                      if (!videoEmbed) {
                        return (
                          <div
                            style={{
                              padding: 14,
                              borderRadius: 8,
                              background: 'rgba(255, 255, 255, 0.02)',
                              border: '1px dashed var(--line)',
                              fontSize: 12,
                              color: 'var(--ink-3)',
                              textAlign: 'center',
                            }}
                          >
                            Paste a valid YouTube, Vimeo, or MP4 video link above to see live preview
                          </div>
                        )
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div
                            style={{
                              width: '100%',
                              borderRadius: 10,
                              overflow: 'hidden',
                              border: '1px solid var(--line)',
                              background: 'var(--admin-color-black)',
                              aspectRatio: '16/9',
                              maxHeight: 220,
                              position: 'relative',
                            }}
                          >
                            {videoEmbed.type === 'video' ? (
                              <video
                                src={videoEmbed.embedUrl}
                                controls
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <iframe
                                src={videoEmbed.embedUrl}
                                title="Video Preview"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                style={{ width: '100%', height: '100%', border: 'none' }}
                              />
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--admin-c-10b981)', fontWeight: 600 }}>
                            <span>✓</span>
                            <span>Live Video Player Verified ({videoEmbed.type.toUpperCase()})</span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>

              {/* SECTION 8: LUXURY THEME ATMOSPHERE & CUSTOMIZATION */}
              <div className="dc-funnel-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'var(--violet-soft)',
                      color: 'var(--violet)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 13,
                    }}
                  >
                    8
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink-1)' }}>
                      Luxury Theme Atmosphere & Customization
                    </h3>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                      Select a luxury preset and freely edit theme name, accent color & backdrop
                    </div>
                  </div>
                </div>

                {/* Preset List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {THEME_PRESETS.map((t) => {
                    const isSelected = themePreset === t.id

                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setThemePreset(t.id)
                          setThemeName(t.name)
                          setThemeDescription(t.desc)
                          setThemeAccentColor(t.accentHex)
                          setThemeBgColor(t.bgHex)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 16,
                          padding: 12,
                          borderRadius: 10,
                          border: isSelected ? '2px solid var(--violet-solid)' : '1px solid var(--line)',
                          background: isSelected ? 'var(--surface-2)' : 'rgba(255, 255, 255, 0.02)',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: t.accentHex,
                            flexShrink: 0,
                            boxShadow: `0 0 10px ${t.accentHex}`,
                          }}
                        />

                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>{t.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{t.desc}</div>
                        </div>

                        {isSelected && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: 'var(--violet)',
                              letterSpacing: '0.05em',
                            }}
                          >
                            SELECTED
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* CUSTOMIZE THEME NAME & COLORS PANEL */}
                <div
                  style={{
                    padding: 18,
                    borderRadius: 10,
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>🎨</span>
                    <span>Edit Theme Name & Atmosphere Colors</span>
                  </div>

                  {/* Editable Theme Name */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                      Theme Display Name (Editable)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Cyber Lime (Spotlight) or আমার স্পেশাল থিম"
                      value={themeName}
                      onChange={(e) => setThemeName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink-1)',
                        fontSize: 13,
                        fontWeight: 700,
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* Editable Theme Description */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                      Theme Tagline / Mood Description (Editable)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Pitch-black backdrop with electric lime theatrical spotlight"
                      value={themeDescription}
                      onChange={(e) => setThemeDescription(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink-1)',
                        fontSize: 12,
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* Custom Accent Color Picker */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 8 }}>
                      Accent Color (Spotlight Aura & CTA Button)
                    </label>
                    {/* Quick chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      {[
                        { hex: '#b5f527', label: 'Cyber Lime' },
                        { hex: '#d4af37', label: 'Obsidian Gold' },
                        { hex: '#10b981', label: 'Emerald' },
                        { hex: '#e2e8f0', label: 'Titanium' },
                        { hex: '#d49a6a', label: 'Warm Sand' },
                        { hex: '#f43f5e', label: 'Crimson' },
                        { hex: '#8b5cf6', label: 'Violet' },
                        { hex: '#06b6d4', label: 'Cyan' },
                      ].map((swatch) => (
                        <button
                          key={swatch.hex}
                          type="button"
                          onClick={() => setThemeAccentColor(swatch.hex)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 10px',
                            borderRadius: 6,
                            border: themeAccentColor.toLowerCase() === swatch.hex.toLowerCase() ? '2px solid var(--violet-solid)' : '1px solid var(--line)',
                            background: 'var(--surface-2)',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'var(--ink-2)',
                          }}
                        >
                          <span style={{ width: 12, height: 12, borderRadius: '50%', background: swatch.hex }} />
                          <span>{swatch.label}</span>
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <input
                        type="color"
                        value={themeAccentColor.startsWith('#') ? themeAccentColor : '#b5f527'}
                        onChange={(e) => setThemeAccentColor(e.target.value)}
                        style={{
                          width: 40,
                          height: 38,
                          borderRadius: 6,
                          border: '1px solid var(--line)',
                          background: 'transparent',
                          cursor: 'pointer',
                          padding: 2,
                        }}
                      />
                      <input
                        type="text"
                        value={themeAccentColor}
                        onChange={(e) => setThemeAccentColor(e.target.value)}
                        placeholder="#b5f527"
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: 8,
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--line)',
                          color: 'var(--ink-1)',
                          fontSize: 13,
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* Custom Background Color Picker */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 8 }}>
                      Atmosphere Backdrop Color
                    </label>
                    {/* Quick background chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      {[
                        { hex: '#000000', label: 'Pitch Black' },
                        { hex: '#0b0c0e', label: 'Obsidian Slate' },
                        { hex: '#0d0f12', label: 'Charcoal' },
                        { hex: '#05120d', label: 'Emerald Noir' },
                        { hex: '#14110f', label: 'Warm Espresso' },
                        { hex: '#070b14', label: 'Midnight Blue' },
                      ].map((swatch) => (
                        <button
                          key={swatch.hex}
                          type="button"
                          onClick={() => setThemeBgColor(swatch.hex)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 10px',
                            borderRadius: 6,
                            border: themeBgColor.toLowerCase() === swatch.hex.toLowerCase() ? '2px solid var(--violet-solid)' : '1px solid var(--line)',
                            background: 'var(--surface-2)',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'var(--ink-2)',
                          }}
                        >
                          <span style={{ width: 12, height: 12, borderRadius: '50%', background: swatch.hex, border: '1px solid rgba(255, 255, 255, 0.15)' }} />
                          <span>{swatch.label}</span>
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <input
                        type="color"
                        value={themeBgColor.startsWith('#') ? themeBgColor : '#000000'}
                        onChange={(e) => setThemeBgColor(e.target.value)}
                        style={{
                          width: 40,
                          height: 38,
                          borderRadius: 6,
                          border: '1px solid var(--line)',
                          background: 'transparent',
                          cursor: 'pointer',
                          padding: 2,
                        }}
                      />
                      <input
                        type="text"
                        value={themeBgColor}
                        onChange={(e) => setThemeBgColor(e.target.value)}
                        placeholder="#000000"
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: 8,
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--line)',
                          color: 'var(--ink-1)',
                          fontSize: 13,
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* Live Theme Button & Aura Preview */}
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 8,
                      background: themeBgColor.startsWith('#') ? themeBgColor : '#000000',
                      border: '1px solid var(--line)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--admin-color-white)' }}>
                        {themeName || 'Selected Theme'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                        Accent: {themeAccentColor} · Backdrop: {themeBgColor}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '10px 20px',
                        borderRadius: 30,
                        background: themeAccentColor.startsWith('#') ? themeAccentColor : '#b5f527',
                        color: '#000000',
                        fontWeight: 900,
                        fontSize: 13,
                        boxShadow: `0 0 16px ${themeAccentColor.startsWith('#') ? themeAccentColor : '#b5f527'}66`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span>⚡</span>
                      <span>অর্ডার কনফার্ম করুন</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 9: TRACKING PIXELS */}
              <div className="dc-funnel-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'var(--violet-soft)',
                      color: 'var(--violet)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 13,
                    }}
                  >
                    9
                  </div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink-1)' }}>
                    Ad Attribution & Tracking Pixels
                  </h3>
                </div>

                <div className="dc-funnel-form-row-2col">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
                        Facebook / Meta Pixel ID
                      </label>
                      <span style={{ fontSize: 11, color: masterPixel ? 'var(--ok)' : 'var(--ink-3)', fontWeight: 600 }}>
                        {masterPixel ? `✓ Global Settings: ${masterPixel}` : 'Configure in Settings → Marketing'}
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder={masterPixel ? `Auto-inherited (${masterPixel})` : 'Enter custom Pixel ID'}
                      value={facebookPixelId}
                      onChange={(e) => setFacebookPixelId(e.target.value.trim())}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink-1)',
                        fontSize: 13,
                        outline: 'none',
                      }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                      Leave blank to automatically use your global Pixel from Settings. Whenever you update your Pixel in Settings, this funnel will update automatically.
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>
                      TikTok Pixel ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. C1234567890ABCDEF"
                      value={tiktokPixelId}
                      onChange={(e) => setTiktokPixelId(e.target.value.trim())}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink-1)',
                        fontSize: 13,
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* LIVE SUMMARY PREVIEW CARD */}
              {selectedProduct && (
                <div
                  className="dc-funnel-card"
                  style={{
                    padding: 20,
                    border: '1px solid var(--line)',
                    background: 'rgba(255, 255, 255, 0.02)',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--violet)', textTransform: 'uppercase', marginBottom: 12 }}>
                    Universe Summary Preview
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-1)' }}>{name || 'Untitled Drop'}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                    URL:{' '}
                    <code>
                      {domain && domain.includes('.') ? `https://${domain}` : subdomain ? `https://${subdomain}.splaro.co` : `https://${slug || 'drop'}.splaro.co`}
                    </code>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 8 }}>
                    Featured: <strong>{customProductTitle || selectedProduct.name}</strong> ({formatTaka(Number(customProductPrice || selectedProduct.basePrice))})
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                    Language: <strong>{productLanguage === 'bn' ? '🇧🇩 বাংলা (Hind Siliguri Font)' : '🇬🇧 English'}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                    Theme: <strong>{themeName || (THEME_PRESETS.find((t) => t.id === themePreset)?.name ?? themePreset)}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                    Delivery: <strong>SPLARO Main Admin Rates</strong>
                  </div>
                </div>
              )}

              {/* Bottom Persistent Save Action Bar */}
              <div className="dc-funnel-bottom-bar">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('LIST')
                    resetForm()
                  }}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'transparent',
                    color: 'var(--ink-2)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  style={{
                    padding: '11px 28px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'var(--violet-solid)',
                    color: 'var(--on-violet)',
                    fontSize: 13.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    opacity: createMutation.isPending || updateMutation.isPending ? 0.7 : 1,
                    boxShadow: '0 4px 14px var(--violet-soft)',
                  }}
                >
                  <DcIcon name="Zap" size={15} />
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving Universe...'
                    : editingUniverseId
                    ? 'Save Universe Changes'
                    : 'Launch Universe Now'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </DcHubFrame>
    )
  }

  /* ──────────────────────────────────────────────────────────────────────────
     RENDER UNIVERSE LIST VIEW
     ────────────────────────────────────────────────────────────────────────── */
  return (
    <DcHubFrame
      crumbGroup="D2C Funnels"
      title="Funnel Universes"
      queries={[funnelsQuery, productsQuery]}
      actions={[
        {
          label: 'View Funnel Orders',
          icon: 'ShoppingBag',
          variant: 'ghost',
          onClick: () => router.push('/dashboard/funnels/orders'),
        },
        {
          label: '+ Launch New Universe',
          icon: 'Flame',
          variant: 'primary',
          onClick: openCreateMode,
        },
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* KPI Strip */}
        <div className="dc-funnel-kpi-grid">
          <div style={{ ...hubCard, padding: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase' }}>
              Active Universes
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink-1)', marginTop: 6 }}>
              {funnels.length}
            </div>
          </div>

          <div style={{ ...hubCard, padding: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Funnel Orders
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink-1)', marginTop: 6 }}>
              {totalOrders}
            </div>
          </div>

          <div style={{ ...hubCard, padding: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase' }}>
              Catalog Products Ready
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink-1)', marginTop: 6 }}>
              {products.length}
            </div>
          </div>
        </div>

        {/* Universe Cards Grid */}
        {funnels.length === 0 ? (
          <div
            style={{
              ...hubCard,
              padding: 48,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--violet-soft)',
                color: 'var(--violet)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DcIcon name="Flame" size={28} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-1)' }}>No Funnel Drops Launched Yet</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4, maxWidth: 440 }}>
                Launch a dedicated standalone single-product landing page on any subdomain (e.g. lifestyle.splaro.co) or custom domain.
              </div>
            </div>
            <button
              type="button"
              onClick={openCreateMode}
              style={{
                padding: '12px 24px',
                borderRadius: 8,
                background: 'var(--violet-solid)',
                color: 'var(--on-violet)',
                fontWeight: 700,
                fontSize: 14,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              + Launch First Universe
            </button>
          </div>
        ) : (
          <div className="dc-funnel-cards-grid">
            {funnels.map((f) => {
              const liveStorefrontUrl = funnelStorefrontUrl({ slug: f.slug, subdomain: f.subdomain, domain: f.domain })
              const hasCustomDomain = Boolean(f.domain && f.domain.includes('.'))
              const publicDomain = hasCustomDomain
                ? f.domain!
                : f.subdomain
                  ? `${f.subdomain}.splaro.co`
                  : `${f.slug}.splaro.co`
              const linkedProduct = products.find((p) => p.id === f.activeProductId)

              return (
                <div
                  key={f.id}
                  style={{
                    ...hubCard,
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--ink-1)' }}>
                        {f.name}
                      </h3>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                        <code>{publicDomain}</code>
                      </div>
                    </div>

                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        background: 'var(--surface-2)',
                        color: 'var(--ink-2)',
                        border: '1px solid var(--line)',
                      }}
                    >
                      {f.ordersCount} Orders
                    </span>
                  </div>

                  {/* Headline Preview */}
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--line)',
                      fontSize: 12,
                      color: 'var(--ink-2)',
                      fontStyle: 'italic',
                    }}
                  >
                    &ldquo;{f.headline || 'STEP OUT OF THE ORDINARY'}&rdquo;
                  </div>

                  {/* Attached Product & Delivery */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--ink-3)' }}>
                    <div>
                      Product:{' '}
                      <strong style={{ color: 'var(--ink-1)' }}>
                        {f.customProductTitle || linkedProduct?.name || 'Assigned Catalog Item'}
                      </strong>
                    </div>
                    <div>
                      Theme:{' '}
                      <span style={{ color: 'var(--ink-2)' }}>
                        {f.themeName || f.themePreset}
                      </span>
                    </div>
                    <div>
                      Language:{' '}
                      <span style={{ color: 'var(--ink-2)' }}>
                        {f.productLanguage === 'en' ? '🇬🇧 English' : '🇧🇩 বাংলা'}
                      </span>
                    </div>
                    <div>
                      Delivery:{' '}
                      <span style={{ color: 'var(--ink-2)' }}>
                        Main Admin Rates
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
                    <a
                      href={liveStorefrontUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        flex: 1,
                        padding: '9px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--line)',
                        background: 'var(--surface-2)',
                        color: 'var(--violet)',
                        fontSize: 12,
                        fontWeight: 700,
                        textDecoration: 'none',
                        textAlign: 'center',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <DcIcon name="Eye" size={13} />
                      View Storefront ↗
                    </a>

                    <button
                      type="button"
                      onClick={() => openEditMode(f)}
                      style={{
                        padding: '9px 16px',
                        borderRadius: 6,
                        border: '1px solid var(--line)',
                        background: 'var(--violet-solid)',
                        color: 'var(--on-violet)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteUniverse(f)}
                      title="Delete Funnel"
                      style={{
                        padding: '9px 12px',
                        borderRadius: 6,
                        border: '1px solid var(--line)',
                        background: 'rgba(239, 68, 68, 0.08)',
                        color: 'var(--admin-c-f87171)',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DcHubFrame>
  )
}
