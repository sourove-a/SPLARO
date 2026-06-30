import { getApiBaseUrl } from '@splaro/config'
import {
  DEFAULT_CATALOG_CHANNELS,
  filterFooterGroupsByCatalogChannels,
  filterHeaderNavByCatalogChannels,
  mergeCatalogChannels,
  type CatalogChannel,
} from '@splaro/types'
import { DEFAULT_STORE_ADDRESS, DEFAULT_STORE_LABEL } from '@/lib/storefront/defaults'
import {
  ACCESSORIES_MEGA_CATEGORIES,
  ACCESSORIES_MEGA_HEROES,
} from '@/lib/storefront/accessories-nav'
import {
  DEFAULT_HOMEPAGE_SECTIONS,
  DEFAULT_OUR_STORY,
  type HomepageSectionsConfig,
  type OurStoryConfig,
  resolveHomepageSections,
  resolveOurStory,
} from '@/lib/storefront/homepage-defaults'

export type {
  CustomerStoryItem,
  CustomerStoriesConfig,
  HomepageSectionsConfig,
  OurStoryConfig,
  StoryPillarConfig,
  StoryPillarIcon,
} from '@/lib/storefront/homepage-defaults'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

export interface MegaMenuCategory {
  label: string
  href: string
  icon?: string
  subcategories?: { label: string; href: string }[]
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

export interface NavLink {
  label: string
  href: string
  badge?: string
  hidden?: boolean
  megaMenu?: MegaMenuConfig
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

export interface SpecialOfferConfig {
  enabled: boolean
  template: 'countdown' | 'banner' | 'minimal'
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

export interface MarqueeConfig {
  enabled: boolean
  items: string[]
}

export interface StorefrontSettings {
  store: {
    name: string
    logo: string
    favicon?: string
    email: string
    phone: string
    address: string
  }
  social: {
    instagram: string
    facebook: string
    tiktok: string
    youtube: string
    whatsapp: string
  }
  shipping: {
    freeDeliveryThreshold: number
    dhakaDeliveryCharge: number
    outsideDhakaCharge: number
  }
  config: {
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
    catalogChannels?: CatalogChannel[]
  }
  marketing?: {
    facebookPixelId?: string
    googleAnalyticsId?: string
  }
}

export const FALLBACK_SETTINGS: StorefrontSettings = {
  store: {
    name: 'SPLARO',
    logo: '',
    email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@splaro.com.bd',
    phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? '',
    address: DEFAULT_STORE_ADDRESS,
  },
  social: { instagram: '', facebook: '', tiktok: '', youtube: '', whatsapp: '' },
  shipping: { freeDeliveryThreshold: 0, dhakaDeliveryCharge: 60, outsideDhakaCharge: 120 },
  config: {
    footerTagline: 'Premium everyday pieces with a quiet luxury finish.',
    footerCopyright: '',
    storeLabel: DEFAULT_STORE_LABEL,
    headerNav: [
      { label: 'Home', href: '/' },
      { label: 'Shop', href: '/shop' },
      {
        label: 'Men',
        href: '/c/men',
        megaMenu: {
          categories: [
            {
              label: 'Panjabi',
              href: '/c/men-panjabi',
              subcategories: [
                { label: 'Premium', href: '/c/men-panjabi-premium' },
                { label: 'Luxury', href: '/c/men-panjabi-luxury' },
                { label: 'Platinum', href: '/c/men-panjabi-platinum' },
              ],
            },
            {
              label: 'Shirts',
              href: '/c/men-shirts',
              subcategories: [
                { label: 'Formal', href: '/c/men-shirts-formal' },
                { label: 'Casual', href: '/c/men-shirts-casual' },
              ],
            },
            { label: 'T-Shirts & Polos', href: '/c/men-tshirts' },
            { label: 'Trousers', href: '/c/men-trousers' },
            { label: 'Jeans', href: '/c/men-jeans' },
          ],
          heroes: [
            {
              label: 'New Arrivals',
              href: '/c/men-new',
              image:
                'https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=800&q=88&auto=format&fit=crop',
            },
            {
              label: 'Best Sellers',
              href: '/c/men-bestsellers',
              image:
                'https://images.unsplash.com/photo-1507680434567-5739c80be1ac?w=800&q=88&auto=format&fit=crop',
            },
            {
              label: 'Summer Edit',
              href: '/c/men-summer',
              image:
                'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=88&auto=format&fit=crop',
            },
          ],
        },
      },
      {
        label: 'Women',
        href: '/c/women',
        megaMenu: {
          categories: [
            {
              label: 'Tops',
              href: '/c/women-tops',
              subcategories: [
                { label: 'Casual', href: '/c/women-tops-casual' },
                { label: 'Formal', href: '/c/women-tops-formal' },
              ],
            },
            { label: 'Dresses', href: '/c/women-dresses' },
            { label: 'Co-ords', href: '/c/women-coords' },
            { label: 'Bottoms', href: '/c/women-bottoms' },
          ],
          heroes: [
            {
              label: 'New Arrivals',
              href: '/c/women-new',
              image:
                'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=88&auto=format&fit=crop',
            },
            {
              label: 'Bestsellers',
              href: '/c/women-bestsellers',
              image:
                'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=88&auto=format&fit=crop',
            },
            {
              label: 'Premium',
              href: '/c/women-premium',
              image:
                'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=88&auto=format&fit=crop',
            },
          ],
        },
      },
      {
        label: 'Kids',
        href: '/c/kids',
        megaMenu: {
          categories: [
            {
              label: 'Boys',
              href: '/c/kids-boys',
              subcategories: [
                { label: 'Panjabi', href: '/c/kids-boys-panjabi' },
                { label: 'T-Shirts', href: '/c/kids-boys-tshirts' },
                { label: 'Bottoms', href: '/c/kids-boys-bottoms' },
              ],
            },
            {
              label: 'Girls',
              href: '/c/kids-girls',
              subcategories: [
                { label: 'Dresses', href: '/c/kids-girls-dresses' },
                { label: 'Tops', href: '/c/kids-girls-tops' },
                { label: 'Co-ords', href: '/c/kids-girls-coords' },
              ],
            },
            { label: 'Newborn', href: '/c/kids-newborn' },
            { label: 'School Edit', href: '/c/kids-school' },
          ],
          heroes: [
            {
              label: 'Panjabi',
              href: '/c/kids-boys-panjabi',
              image:
                'https://images.unsplash.com/photo-1503919545889-aef636e10ad4?w=800&q=88&auto=format&fit=crop',
            },
            {
              label: 'Dresses',
              href: '/c/kids-girls-dresses',
              image:
                'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=800&q=88&auto=format&fit=crop',
            },
            {
              label: 'School Edit',
              href: '/c/kids-school',
              image:
                'https://images.unsplash.com/photo-1514090458221-65bb69cf63e6?w=800&q=88&auto=format&fit=crop',
            },
          ],
        },
      },
      {
        label: 'Footwear',
        href: '/c/footwear',
        megaMenu: {
          categories: [
            {
              label: 'Men',
              href: '/c/footwear-men',
              subcategories: [
                { label: 'Sneakers', href: '/c/footwear-men-sneakers' },
                { label: 'Loafers', href: '/c/footwear-men-loafers' },
                { label: 'Sandals', href: '/c/footwear-men-sandals' },
              ],
            },
            {
              label: 'Women',
              href: '/c/footwear-women',
              subcategories: [
                { label: 'Heels', href: '/c/footwear-women-heels' },
                { label: 'Flats', href: '/c/footwear-women-flats' },
                { label: 'Sneakers', href: '/c/footwear-women-sneakers' },
              ],
            },
            { label: 'Kids', href: '/c/footwear-kids' },
          ],
          heroes: [
            {
              label: 'Sneakers',
              href: '/c/footwear-sneakers',
              image:
                'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=88&auto=format&fit=crop',
            },
            {
              label: 'Loafers',
              href: '/c/footwear-loafers',
              image:
                'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&q=88&auto=format&fit=crop',
            },
            {
              label: 'Sandals',
              href: '/c/footwear-sandals',
              image:
                'https://images.unsplash.com/photo-1606107557195-0f29cb4c3ada?w=800&q=88&auto=format&fit=crop',
            },
          ],
        },
      },
      {
        label: 'Accessories',
        href: '/accessories',
        megaMenu: {
          categories: [...ACCESSORIES_MEGA_CATEGORIES],
          heroes: [...ACCESSORIES_MEGA_HEROES],
        },
      },
    ],
    footerGroups: [
      {
        id: 'shop',
        title: 'Shop',
        links: [
          { label: 'All products', href: '/shop' },
          { label: 'Men', href: '/c/men' },
          { label: 'Women', href: '/c/women' },
          { label: 'Kids', href: '/c/kids' },
          { label: 'Footwear', href: '/c/footwear' },
          { label: 'Accessories', href: '/accessories' },
        ],
      },
      {
        id: 'support',
        title: 'Support',
        links: [
          { label: 'Contact', href: '/contact' },
          { label: 'Track order', href: '/track-order' },
          { label: 'Shipping', href: '/shipping' },
          { label: 'Returns', href: '/returns' },
          { label: 'Size guide', href: '/size-guide' },
        ],
      },
      {
        id: 'company',
        title: 'Company',
        links: [
          { label: 'About', href: '/about' },
          { label: 'Editorial', href: '/editorial' },
          { label: 'Privacy policy', href: '/privacy' },
          { label: 'Terms', href: '/terms' },
        ],
      },
    ],
    marquee: { enabled: false, items: [] },
    specialOffer: { enabled: false, template: 'countdown', title: '', ctaLabel: 'Shop now', ctaHref: '/shop' },
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
  },
  marketing: { facebookPixelId: '', googleAnalyticsId: '' },
}

async function fetchSettingsRaw(): Promise<StorefrontSettings> {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/storefront/settings?storeId=${encodeURIComponent(STORE_ID)}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Settings API ${res.status}`)
  return (await res.json()) as StorefrontSettings
}

// No web-layer cache: admin saves reflect on the storefront instantly (real-time).
// fetchSettingsRaw already uses `cache: 'no-store'`; the settings API is local and
// server-cached, so reading fresh each render stays fast.
const getCachedSettings = fetchSettingsRaw

function normalizeHref(href: string): string {
  // treat /c/foo and /collections/foo as the same slug
  return href.replace(/^\/(collections|c)\//, '__col__/')
}

function restoreMegaMenus(nav: NavLink[]): NavLink[] {
  const fallback = FALLBACK_SETTINGS.config.headerNav ?? []
  return nav.map((item) => {
    const byLabel = fallback.find(
      (entry) => entry.label.toLowerCase() === item.label.toLowerCase(),
    )
    if (byLabel?.megaMenu) {
      return { ...item, href: byLabel.href, megaMenu: byLabel.megaMenu }
    }
    if (item.megaMenu) return item
    const byHref = fallback.find(
      (entry) => normalizeHref(entry.href) === normalizeHref(item.href),
    )
    return byHref?.megaMenu ? { ...item, href: byHref.href, megaMenu: byHref.megaMenu } : item
  })
}

function ensureFallbackNavItems(nav: NavLink[]): NavLink[] {
  const fallback = FALLBACK_SETTINGS.config.headerNav ?? []
  let result = [...nav]

  for (const fallbackItem of fallback) {
    const exists = result.some(
      (item) =>
        normalizeHref(item.href) === normalizeHref(fallbackItem.href) ||
        item.label.toLowerCase() === fallbackItem.label.toLowerCase(),
    )
    if (!exists) {
      // append missing fallback items (e.g. Accessories) at the end
      result = [...result, fallbackItem]
    }
  }
  return result
}

function applyStoreDefaults(settings: StorefrontSettings): StorefrontSettings {
  const fallbackGroups = FALLBACK_SETTINGS.config.footerGroups ?? []
  const headerNav = settings.config.headerNav?.length
    ? settings.config.headerNav
    : FALLBACK_SETTINGS.config.headerNav
  const normalizedHeaderNav = restoreMegaMenus(
    ensureFallbackNavItems(
      headerNav?.some((item) => item.href === '/')
        ? (headerNav ?? [])
        : [{ label: 'Home', href: '/' }, ...(headerNav ?? [])],
    ),
  )

  const catalogChannels = mergeCatalogChannels(
    settings.config.catalogChannels ?? FALLBACK_SETTINGS.config.catalogChannels,
  )
  const filteredHeaderNav = filterHeaderNavByCatalogChannels(normalizedHeaderNav, catalogChannels)
  const footerGroupsSource =
    settings.config.footerGroups?.length ? settings.config.footerGroups : fallbackGroups
  const filteredFooterGroups = filterFooterGroupsByCatalogChannels(
    footerGroupsSource,
    catalogChannels,
  )

  return {
    ...settings,
    store: {
      ...settings.store,
      address: settings.store.address?.trim() || DEFAULT_STORE_ADDRESS,
    },
    config: {
      ...settings.config,
      footerTagline:
        settings.config.footerTagline?.trim() ||
        FALLBACK_SETTINGS.config.footerTagline ||
        'Premium everyday pieces with a quiet luxury finish.',
      footerGroups: filteredFooterGroups,
      headerNav: filteredHeaderNav,
      catalogChannels,
      storeLabel: settings.config.storeLabel?.trim() || DEFAULT_STORE_LABEL,
      newsletter: {
        ...FALLBACK_SETTINGS.config.newsletter!,
        ...settings.config.newsletter,
        perks:
          settings.config.newsletter?.perks?.filter(Boolean).length
            ? settings.config.newsletter.perks
            : FALLBACK_SETTINGS.config.newsletter!.perks,
      },
      ourStory: resolveOurStory(settings.config.ourStory),
      homepage: resolveHomepageSections(settings.config.homepage),
    },
  }
}

export async function getStorefrontSettings(): Promise<StorefrontSettings> {
  try {
    return applyStoreDefaults(await getCachedSettings())
  } catch {
    return FALLBACK_SETTINGS
  }
}
