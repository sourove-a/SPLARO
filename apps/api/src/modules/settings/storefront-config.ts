export interface NavLink {
  label: string
  href: string
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
  catalogChannels?: CatalogChannel[]
  shippingZones?: ShippingZonesConfig
  catalog?: CatalogPolicyConfig
}

export type { CatalogChannel }
export { DEFAULT_CATALOG_CHANNELS, mergeCatalogChannels }

import {
  DEFAULT_HOMEPAGE_SECTIONS,
  DEFAULT_OUR_STORY,
} from './homepage-defaults'
import {
  type CatalogChannel,
  DEFAULT_CATALOG_CHANNELS,
  mergeCatalogChannels,
} from '@splaro/types'

export const DEFAULT_HEADER_NAV: NavLink[] = [
  { label: 'Shop', href: '/shop' },
  { label: 'Summer Edition', href: '/c/summer-edition' },
  { label: 'Men', href: '/c/men' },
  { label: 'Women', href: '/c/women' },
  { label: 'Kids', href: '/c/kids' },
  { label: 'Footwear', href: '/c/footwear' },
  { label: 'Accessories', href: '/accessories' },
]

function ensureKidsNavItem(nav: NavLink[]): NavLink[] {
  const hasKids = nav.some(
    (item) => item.href === '/c/kids' || item.href === '/collections/kids' || item.label.toLowerCase() === 'kids',
  )
  if (hasKids) return nav

  const kidsItem: NavLink = { label: 'Kids', href: '/c/kids' }
  const footwearIndex = nav.findIndex(
    (item) => item.href === '/c/footwear' || item.href === '/collections/footwear' || item.label.toLowerCase() === 'footwear',
  )

  if (footwearIndex >= 0) {
    return [...nav.slice(0, footwearIndex), kidsItem, ...nav.slice(footwearIndex)]
  }

  return [...nav, kidsItem]
}

export function mergeHeaderNav(current: NavLink[] | undefined, incoming: NavLink[]): NavLink[] {
  const currentByHref = new Map((current ?? []).map((item) => [item.href, item]))

  return ensureKidsNavItem(
    incoming.map((item) => {
      const previous = currentByHref.get(item.href)
      if (item.megaMenu || !previous?.megaMenu) return item
      return { ...item, megaMenu: previous.megaMenu }
    }),
  )
}

export const DEFAULT_FOOTER_GROUPS: FooterGroup[] = [
  {
    id: 'shop',
    title: 'Shop',
    links: [
      { label: 'New Arrivals', href: '/shop' },
      { label: 'Women', href: '/c/women' },
      { label: 'Men', href: '/c/men' },
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
    storeLabel: 'Store',
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
    shippingZones: { dhakaSameDay: true, outsideDhaka: true },
    catalog: { autoGenerateSku: false },
    smtp: {
      enabled: false,
      host: '',
      port: 587,
      secure: false,
      user: '',
      password: '',
      fromName: 'SPLARO',
      fromEmail: '',
      replyTo: '',
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
      customerStories: {
        ...base.ourStory!.customerStories,
        ...input.ourStory?.customerStories,
        stories: input.ourStory?.customerStories?.stories?.length
          ? input.ourStory.customerStories.stories
          : base.ourStory!.customerStories.stories,
      },
    },
    homepage: { ...base.homepage!, ...input.homepage },
    smtp: { ...base.smtp!, ...input.smtp },
    catalogChannels: mergeCatalogChannels(input.catalogChannels ?? base.catalogChannels),
    shippingZones: { ...base.shippingZones!, ...input.shippingZones },
    catalog: { ...base.catalog!, ...input.catalog },
    headerNav: mergeHeaderNav(
      base.headerNav,
      input.headerNav?.length ? input.headerNav : base.headerNav ?? DEFAULT_HEADER_NAV,
    ),
    footerGroups: input.footerGroups?.length ? input.footerGroups : base.footerGroups,
  }
}
