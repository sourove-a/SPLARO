import { apiFetch } from './client'
import type { CatalogChannel } from '@splaro/types'

export interface NavLink {
  label: string
  href: string
  hidden?: boolean
}

export interface FooterLink {
  label: string
  href: string
  external?: boolean
}

export interface FooterGroup {
  id: string
  title: string
  links: FooterLink[]
}

export type OfferTemplate = 'countdown' | 'banner' | 'minimal'

export interface SpecialOfferConfig {
  enabled: boolean
  template: OfferTemplate
  title: string
  subtitle?: string
  badge?: string
  discountLabel?: string
  ctaLabel?: string
  ctaHref?: string
  endsAt?: string | null
}

export interface NewsletterConfig {
  enabled: boolean
  eyebrow: string
  title: string
  subtitle: string
  placeholder: string
  buttonLabel: string
  note: string
  perks: string[]
}

export type StoryPillarIcon = 'sprout' | 'leaf' | 'gem' | 'star' | 'heart' | 'sparkles'

export interface StoryPillarConfig {
  id: string
  enabled: boolean
  icon: StoryPillarIcon
  title: string
  body: string
}

export interface CustomerStoryItem {
  id: string
  enabled: boolean
  name: string
  location: string
  rating: number
  date: string
  text: string
  product: string
  avatar: string
}

export interface CustomerStoriesConfig {
  enabled: boolean
  label: string
  rating: string
  hint: string
  stories: CustomerStoryItem[]
}

export interface OurStoryConfig {
  enabled: boolean
  eyebrow: string
  title: string
  body1: string
  body2: string
  quote: string
  quoteAttribution: string
  earthTagline1: string
  earthTagline2: string
  showEarthLogo: boolean
  pillars: StoryPillarConfig[]
  customerStories: CustomerStoriesConfig
}

export interface HomepageSectionsConfig {
  hero: boolean
  marquee: boolean
  collections: boolean
  trustBar: boolean
  catalog: boolean
  specialOffer: boolean
  ourStory: boolean
  instagram: boolean
  newsletter: boolean
}

export interface MarqueeConfig {
  enabled: boolean
  items: string[]
}

export interface SmtpConfig {
  enabled: boolean
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  fromName: string
  fromEmail: string
  replyTo?: string
}

export interface AdminSettingsData {
  store: {
    name: string
    email: string
    phone: string
    domain: string
    currency: string
    timezone: string
    logo: string
    favicon: string
    description: string
    address: string
  }
  branding: {
    logo: string
    favicon: string
    storeImage: string
    storeLabel: string
    footerTagline: string
    footerCopyright: string
  }
  contact: {
    email: string
    phone: string
    whatsapp: string
    address: string
  }
  social: {
    instagram: string
    facebook: string
    tiktok: string
    youtube: string
  }
  navigation: {
    headerNav: NavLink[]
    footerGroups: FooterGroup[]
  }
  marquee: MarqueeConfig
  specialOffer: SpecialOfferConfig
  newsletter: NewsletterConfig
  ourStory: OurStoryConfig
  homepage: HomepageSectionsConfig
  catalogChannels: CatalogChannel[]
  catalog: {
    autoGenerateSku: boolean
  }
  payments: {
    cod: boolean
    bkash: boolean
    sslcommerz: boolean
    nagad?: boolean
  }
  shipping: {
    dhakaSameDay: boolean
    outsideDhaka: boolean
    freeShippingMin: string
    dhakaDeliveryCharge?: number
    outsideDhakaCharge?: number
  }
  smtp: SmtpConfig
  emailEnabled: boolean
  marketing: {
    facebookPixelId: string
    googleAnalyticsId: string
  }
  telegram?: {
    botToken: string
    chatId: string
    isActive: boolean
    notifyOrders: boolean
    notifyPayments: boolean
    notifyCourier: boolean
    notifyStock: boolean
    reportDaily: boolean
  } | null
}

export function fetchSettings() {
  return apiFetch<AdminSettingsData>('/admin/settings')
}

export function updateSettings(data: Partial<AdminSettingsData>) {
  return apiFetch<AdminSettingsData>('/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export interface NewsletterSubscriberRow {
  id: string
  email: string
  status: string
  createdAt: string
}

export function fetchNewsletterSubscribers() {
  return apiFetch<{ total: number; subscribers: NewsletterSubscriberRow[] }>(
    '/admin/settings/newsletter-subscribers',
  )
}

export interface CatalogChannelStats {
  slug: string
  shopCategory: string
  publishedProducts: number
  inStockProducts: number
  totalStockUnits: number
}

export function fetchCatalogChannelStats() {
  return apiFetch<{ channels: CatalogChannelStats[] }>('/admin/settings/catalog-stats')
}
