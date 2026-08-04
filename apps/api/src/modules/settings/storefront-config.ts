export interface NavLink {
  label: string
  href: string
  hidden?: boolean
  megaMenu?: MegaMenuConfig
}

export interface MegaMenuSubcategory {
  label: string
  href: string
}

export interface MegaMenuCategory {
  label: string
  href: string
  subcategories?: MegaMenuSubcategory[]
}

export interface MegaMenuHero {
  label: string
  href: string
  image: string
}

export interface MegaMenuConfig {
  categories: MegaMenuCategory[]
  heroes: MegaMenuHero[]
}

export interface MenuHeroOverride {
  label: string
  href: string
  image: string
}

export interface DepartmentMenuOverride {
  departmentSlug: string
  hidden?: boolean
  forceVisible?: boolean
  hiddenCategoryIds?: string[]
  pinnedCategoryIds?: string[]
  categoryOrder?: string[]
  heroes?: MenuHeroOverride[]
}

export interface MenuOverridesConfig {
  autoSync?: boolean
  departments?: DepartmentMenuOverride[]
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
  /** Homepage platinum story-deck cards (coverflow). */
  storyDeckCards: StoryDeckCardConfig[]
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

export interface SmtpAccountConfig extends SmtpConfig {
  id: string
  label: string
  priority: number
  lastTestStatus?: 'success' | 'failed'
  lastTestMessage?: string
  lastTestedAt?: string
}

export interface ShippingZonesConfig {
  dhakaSameDay: boolean
  outsideDhaka: boolean
}

/** Catalog behaviour — default manual SKUs for live launch. */
export interface CatalogPolicyConfig {
  autoGenerateSku: boolean
}

export interface StorefrontConfig {
  footerTagline?: string
  footerCopyright?: string
  storeImage?: string
  storeLabel?: string
  headerNav?: NavLink[]
  footerGroups?: FooterGroup[]
  marquee?: MarqueeConfig
  specialOffer?: SpecialOfferConfig
  newsletter?: NewsletterConfig
  ourStory?: OurStoryConfig
  homepage?: HomepageSectionsConfig
  smtp?: SmtpConfig
  smtpAccounts?: SmtpAccountConfig[]
  catalogChannels?: CatalogChannel[]
  shippingZones?: ShippingZonesConfig
  catalog?: CatalogPolicyConfig
  shopFilters?: ShopFiltersConfig
  footwear?: Record<string, unknown>
  menuOverrides?: MenuOverridesConfig
  /**
   * Revenue the store is aiming at in a single trading day, in BDT. Drives the
   * dashboard's goal bar. Absent means the operator has not set one — show the
   * prompt to set it rather than assuming a target.
   */
  dailyRevenueGoal?: number
}

export type { CatalogChannel }
export { DEFAULT_CATALOG_CHANNELS, mergeCatalogChannels }

import {
  DEFAULT_HOMEPAGE_SECTIONS,
  DEFAULT_OUR_STORY,
} from './homepage-defaults'
import { mergeStoryDeckCards, type StoryDeckCardConfig } from './story-deck-defaults'
export type { StoryDeckCardConfig, StoryDeckCardId, StoryDeckCardIcon } from './story-deck-defaults'
import {
  type CatalogChannel,
  DEFAULT_CATALOG_CHANNELS,
  mergeCatalogChannels,
  mergeShopFilters,
  type ShopFiltersConfig,
} from '@splaro/types'

export const DEFAULT_HEADER_NAV: NavLink[] = [
  { label: 'Shop', href: '/shop' },
  { label: 'Men', href: '/c/men' },
  { label: 'Women', href: '/c/women' },
  { label: 'Kids', href: '/c/kids' },
  { label: 'Footwear', href: '/c/footwear' },
  { label: 'Accessories', href: '/accessories' },
]

export function mergeHeaderNav(_current: NavLink[] | undefined, incoming: NavLink[]): NavLink[] {
  // Admin settings are the source of truth. Do not silently restore removed links
  // or stale fixture mega-menu payloads; NavBuilderService creates live mega data.
  return incoming.map(({ label, href, hidden }) => ({
    label,
    href,
    ...(hidden !== undefined ? { hidden } : {}),
  }))
}

function normalizeHeaderPath(href: string): string {
  return (href ?? '').split(/[?#]/, 1)[0]?.replace(/\/$/, '') || '/'
}

/** Department slug from header href (`/c/men`, `/collections/men`, `/accessories`). */
export function headerDeptSlug(href: string): string | null {
  const path = normalizeHeaderPath(href)
  const match = path.match(/^\/(?:c|collections)\/([^/]+)$/)
  if (match?.[1]) return match[1]
  if (path === '/accessories') return 'accessories'
  if (path === '/new-arrivals') return 'new-arrivals'
  return null
}

function headerLinkMatchesDefault(item: NavLink, def: NavLink): boolean {
  const href = normalizeHeaderPath(item.href)
  const defHref = normalizeHeaderPath(def.href)
  if (href === defHref) return true

  const itemSlug = headerDeptSlug(item.href)
  const defSlug = headerDeptSlug(def.href)
  if (itemSlug && defSlug && itemSlug === defSlug) return true

  const label = item.label?.trim().toLowerCase() ?? ''
  const defLabel = def.label.trim().toLowerCase()
  if (defLabel === 'accessories' && (label === 'accessories' || itemSlug === 'accessories')) {
    return true
  }
  return false
}

/**
 * Heal-on-read: re-inject essential department links missing from a saved headerNav.
 * Does not rewrite custom order/labels for links that already exist (any href alias).
 * Accessories that were only `hidden` are surfaced again.
 */
export function ensureEssentialHeaderDepartments(nav: NavLink[] | undefined): NavLink[] {
  const next = (nav ?? []).map((item) => ({ ...item }))

  for (const def of DEFAULT_HEADER_NAV) {
    const idx = next.findIndex((item) => headerLinkMatchesDefault(item, def))
    const isAccessories = normalizeHeaderPath(def.href) === '/accessories'

    if (idx < 0) {
      const link: NavLink = { label: def.label, href: def.href }
      if (isAccessories) {
        const footwearIdx = next.findIndex((item) =>
          headerLinkMatchesDefault(item, { label: 'Footwear', href: '/c/footwear' }),
        )
        if (footwearIdx >= 0) next.splice(footwearIdx + 1, 0, link)
        else next.push(link)
      } else {
        next.push(link)
      }
      continue
    }

    if (isAccessories && next[idx]?.hidden) {
      const current = next[idx]!
      next[idx] = {
        label: current.label?.trim() || 'Accessories',
        href: '/accessories',
        ...(current.megaMenu ? { megaMenu: current.megaMenu } : {}),
      }
    }
  }

  return next
}

export const DEFAULT_FOOTER_GROUPS: FooterGroup[] = [
  {
    id: 'shop',
    title: 'Shop',
    links: [
      { label: 'New Arrivals', href: '/new-arrivals' },
      { label: 'Best Sellers', href: '/best-sellers' },
      { label: 'Women', href: '/c/women' },
      { label: 'Men', href: '/c/men' },
      { label: 'Kids', href: '/c/kids' },
      { label: 'Footwear', href: '/c/footwear' },
      { label: 'Accessories', href: '/accessories' },
      { label: 'Collections', href: '/collections' },
    ],
  },
  {
    id: 'care',
    title: 'Customer Care',
    links: [
      { label: 'Track Order', href: '/track-order' },
      { label: 'Returns & Exchange', href: '/returns' },
      { label: 'Contact Us', href: '/contact' },
      { label: 'Size Guide', href: '/size-guide' },
    ],
  },
  {
    id: 'company',
    title: 'Company',
    links: [
      { label: 'About SPLARO', href: '/about' },
      { label: 'Journal', href: '/editorial' },
    ],
  },
  {
    id: 'policies',
    title: 'Policies',
    links: [
      { label: 'Shipping Policy', href: '/shipping' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms & Conditions', href: '/terms' },
      { label: 'Payment Policy', href: '/payment-policy' },
    ],
  },
]

export function emptyStorefrontConfig(): StorefrontConfig {
  return {
    footerTagline: '',
    footerCopyright: '',
    storeLabel: '',
    headerNav: DEFAULT_HEADER_NAV,
    footerGroups: DEFAULT_FOOTER_GROUPS,
    marquee: { enabled: false, items: [] },
    specialOffer: {
      enabled: false,
      template: 'countdown',
      title: '',
      subtitle: '',
      badge: '',
      discountLabel: '',
      ctaLabel: 'Shop now',
      ctaHref: '/shop',
      endsAt: null,
    },
    newsletter: {
      enabled: true,
      eyebrow: 'Stay connected',
      title: 'Be the first to know.',
      subtitle: 'New drops, exclusive offers & styling inspiration — straight to your inbox.',
      placeholder: 'Your email address',
      buttonLabel: 'Subscribe',
      note: 'No spam. Unsubscribe anytime.',
      perks: ['Early access to drops', 'Member-only offers', 'Style notes & care tips'],
    },
    ourStory: DEFAULT_OUR_STORY,
    homepage: DEFAULT_HOMEPAGE_SECTIONS,
    catalogChannels: DEFAULT_CATALOG_CHANNELS.map((channel) => ({ ...channel })),
    shopFilters: mergeShopFilters(undefined),
    shippingZones: { dhakaSameDay: true, outsideDhaka: true },
    catalog: { autoGenerateSku: false },
    smtp: {
      // Disabled until a password is saved — prevents new stores inheriting SPLARO's mailbox as active.
      enabled: false,
      host: 'smtp.hostinger.com',
      port: 587,
      secure: false,
      user: 'noreply@splaro.co',
      password: '',
      fromName: 'SPLARO',
      fromEmail: 'noreply@splaro.co',
      replyTo: 'support@splaro.co',
    },
  }
}

export function mergeStorefrontConfig(raw: unknown): StorefrontConfig {
  const base = emptyStorefrontConfig()
  if (!raw || typeof raw !== 'object') return base

  const input = raw as StorefrontConfig
  return {
    ...base,
    ...input,
    marquee: { ...base.marquee!, ...input.marquee },
    specialOffer: { ...base.specialOffer!, ...input.specialOffer },
    newsletter: {
      ...base.newsletter!,
      ...input.newsletter,
      perks: input.newsletter?.perks?.length ? input.newsletter.perks : base.newsletter!.perks,
    },
    ourStory: {
      ...base.ourStory!,
      ...input.ourStory,
      pillars: input.ourStory?.pillars?.length ? input.ourStory.pillars : base.ourStory!.pillars,
      storyDeckCards: mergeStoryDeckCards(input.ourStory?.storyDeckCards),
      customerStories: {
        ...base.ourStory!.customerStories,
        ...input.ourStory?.customerStories,
        stories: [],
        rating: '',
        hint: '',
      },
    },
    homepage: { ...base.homepage!, ...input.homepage },
    smtp: { ...base.smtp!, ...input.smtp },
    smtpAccounts: Array.isArray(input.smtpAccounts) ? input.smtpAccounts : [],
    catalogChannels: mergeCatalogChannels(input.catalogChannels ?? base.catalogChannels),
    shopFilters: mergeShopFilters(input.shopFilters ?? base.shopFilters),
    shippingZones: { ...base.shippingZones!, ...input.shippingZones },
    catalog: { ...base.catalog!, ...input.catalog },
    menuOverrides: input.menuOverrides ?? base.menuOverrides,
    headerNav: mergeHeaderNav(
      base.headerNav,
      input.headerNav?.length ? input.headerNav : base.headerNav ?? DEFAULT_HEADER_NAV,
    ),
    footerGroups: input.footerGroups?.length ? input.footerGroups : base.footerGroups,
  }
}
