import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { CATEGORY_SUBCATEGORIES, getServerApiBaseUrl } from '@splaro/config'
import { fetchWithTimeout, isCiOrProductionBuild } from '@/lib/server/build-safe-fetch'
import { settingsFetchTimeoutMs } from '@/lib/server/fetch-timeouts'
import {
  DEFAULT_CATALOG_CHANNELS,
  DEFAULT_SHOP_FILTERS,
  filterFooterGroupsByCatalogChannels,
  filterHeaderNavByCatalogChannels,
  mergeCatalogChannels,
  mergeShopFilters,
  type CatalogChannel,
  type ShopFiltersConfig,
} from '@splaro/types'
import {
  DEFAULT_STORE_ADDRESS,
  DEFAULT_STORE_LABEL,
  DEFAULT_SUPPORT_EMAIL,
} from '@/lib/storefront/defaults'
import { fetchLiveHeaderNav } from '@/lib/catalog/menu-nav'
import {
  ACCESSORIES_MEGA_CATEGORIES,
  ACCESSORIES_MEGA_HEROES,
} from '@/lib/storefront/accessories-nav'
import { EDITORIAL } from '@/lib/assets/editorial-images'
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

/** Offline / build fallback megas — same labels as category-tree-defaults (never legacy T-Shirts copy). */
function fallbackMegaCategories(department: keyof typeof CATEGORY_SUBCATEGORIES): MegaMenuCategory[] {
  return (CATEGORY_SUBCATEGORIES[department] ?? []).map((entry) => ({
    label: entry.name,
    href: `/c/${entry.slug}`,
  }))
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
  payments: {
    cod: boolean
    bkash: boolean
    nagad: boolean
    sslcommerz: boolean
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
    shopFilters?: ShopFiltersConfig
  }
  marketing?: {
    facebookPixelId?: string
    googleAnalyticsId?: string
  }
}

export const FALLBACK_SETTINGS: StorefrontSettings = {
  store: {
    name: 'SPLARO',
    logo: '/images/logo/splaro-logo-black-premium.webp',
    email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? DEFAULT_SUPPORT_EMAIL,
    phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? '',
    address: DEFAULT_STORE_ADDRESS,
  },
  social: {
    instagram: 'https://www.instagram.com/splaro.bd',
    facebook: 'https://www.facebook.com/SPLARO/',
    tiktok: 'https://www.tiktok.com/@splaro_bd',
    youtube: 'https://www.youtube.com/@SPLARO',
    whatsapp: '',
  },
  shipping: { freeDeliveryThreshold: 0, dhakaDeliveryCharge: 60, outsideDhakaCharge: 120 },
  payments: { cod: true, bkash: false, nagad: false, sslcommerz: false },
  config: {
    footerTagline: 'Premium everyday pieces with a quiet luxury finish.',
    footerCopyright: '',
    storeLabel: DEFAULT_STORE_LABEL,
    headerNav: [
      { label: 'Shop', href: '/shop' },
      { label: 'Summer Edition', href: '/c/summer-edition' },
      {
        label: 'Men',
        href: '/c/men',
        megaMenu: {
          categories: fallbackMegaCategories('men'),
          heroes: [
            {
              label: 'New Arrivals',
              href: '/new-arrivals?dept=men',
              image: EDITORIAL.menNew,
            },
            {
              label: 'Best Sellers',
              href: '/best-sellers?dept=men',
              image: EDITORIAL.menBest,
            },
            {
              label: 'Panjabi',
              href: '/c/panjabi',
              image: EDITORIAL.menSummer,
            },
          ],
        },
      },
      {
        label: 'Women',
        href: '/c/women',
        megaMenu: {
          categories: fallbackMegaCategories('women'),
          heroes: [
            {
              label: 'New Arrivals',
              href: '/new-arrivals?dept=women',
              image: EDITORIAL.womenNew,
            },
            {
              label: 'Best Sellers',
              href: '/best-sellers?dept=women',
              image: EDITORIAL.womenBest,
            },
            {
              label: 'Saree',
              href: '/c/sarees',
              image: EDITORIAL.womenPremium,
            },
          ],
        },
      },
      {
        label: 'Kids',
        href: '/c/kids',
        megaMenu: {
          categories: fallbackMegaCategories('kids'),
          heroes: [
            {
              label: 'Girls Wear',
              href: '/c/girls-wear',
              image: EDITORIAL.kidsDresses,
            },
            {
              label: 'Boys Wear',
              href: '/c/boys-wear',
              image: EDITORIAL.kidsPanjabi,
            },
            {
              label: 'Party Wear',
              href: '/c/kids-party-wear',
              image: EDITORIAL.kidsSchool,
            },
          ],
        },
      },
      {
        label: 'Footwear',
        href: '/c/footwear',
        megaMenu: {
          categories: fallbackMegaCategories('footwear'),
          heroes: [
            {
              label: 'Sneakers',
              href: '/c/sneakers',
              image: EDITORIAL.footwearSneakers,
            },
            {
              label: 'Sandals',
              href: '/c/sandals',
              image: EDITORIAL.footwearSandals,
            },
            {
              label: 'Shop all',
              href: '/c/footwear',
              image: EDITORIAL.footwearLoafers,
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
          { label: 'New Arrivals', href: '/new-arrivals' },
          { label: 'Best Sellers', href: '/best-sellers' },
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
    ],
    marquee: {
      enabled: true,
      items: [
        'SPLARO — Quiet luxury for Bangladesh',
        'Cash on delivery nationwide',
        'Free delivery on qualifying orders',
        'New season edit — shop now',
      ],
    },
    specialOffer: { enabled: false, template: 'countdown', title: '', ctaLabel: 'Shop now', ctaHref: '/shop' },
    newsletter: {
      enabled: true,
      eyebrow: 'Newsletter',
      title: 'Be the first to know.',
      subtitle: '',
      placeholder: 'Email address',
      buttonLabel: 'Subscribe',
      note: '',
      perks: [],
    },
    ourStory: DEFAULT_OUR_STORY,
    homepage: DEFAULT_HOMEPAGE_SECTIONS,
    catalogChannels: DEFAULT_CATALOG_CHANNELS.map((channel) => ({ ...channel })),
    shopFilters: DEFAULT_SHOP_FILTERS,
  },
  marketing: { facebookPixelId: '', googleAnalyticsId: '' },
}

async function fetchStorefrontNav(): Promise<NavLink[] | null> {
  if (isCiOrProductionBuild()) return null

  const base = getServerApiBaseUrl()
  try {
    const res = await fetchWithTimeout(
      `${base}/storefront/nav?storeId=${encodeURIComponent(STORE_ID)}`,
      {
        ...(process.env.NODE_ENV === 'development'
          ? { cache: 'no-store' as const }
          : { next: { revalidate: 60, tags: ['storefront-nav'] } }),
        timeoutMs: settingsFetchTimeoutMs(),
      },
    )
    if (!res?.ok) return null
    const data = (await res.json()) as { headerNav?: NavLink[] }
    return data.headerNav?.length ? data.headerNav : null
  } catch {
    return null
  }
}

async function fetchNavQuick(): Promise<[NavLink[] | null, NavLink[] | null]> {
  // Dev: allow full settings timeout so Men/Women megas aren't dropped for Accessories FALLBACK.
  // Prod: keep a short cap so homepage TTFB stays fast; fillMissing still covers gaps.
  const cap =
    process.env.NODE_ENV === 'development'
      ? settingsFetchTimeoutMs()
      : Math.min(settingsFetchTimeoutMs(), 1200)
  const withCap = (fn: () => Promise<NavLink[] | null>) =>
    Promise.race([
      fn(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), cap)),
    ]).catch(() => null)

  return Promise.all([withCap(fetchLiveHeaderNav), withCap(fetchStorefrontNav)])
}

async function fetchSettingsRaw(): Promise<StorefrontSettings> {
  if (isCiOrProductionBuild()) {
    return FALLBACK_SETTINGS
  }

  const base = getServerApiBaseUrl()
  const settingsRes = await fetchWithTimeout(
    `${base}/storefront/settings?storeId=${encodeURIComponent(STORE_ID)}`,
    {
      next: { revalidate: 10, tags: ['storefront-settings'] },
      timeoutMs: settingsFetchTimeoutMs(),
    },
  )

  if (!settingsRes?.ok) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[splaro] Storefront settings API unavailable — using bundled defaults. Run: pnpm dev:stack',
        settingsRes === null ? 'fetch failed' : `HTTP ${settingsRes.status}`,
      )
    }
    return FALLBACK_SETTINGS
  }

  let settings: StorefrontSettings
  try {
    settings = (await settingsRes.json()) as StorefrontSettings
  } catch {
    return FALLBACK_SETTINGS
  }

  // Always merge live department megas (Men/Women/Kids…) — skipping this left
  // Accessories-only FALLBACK megas and wrong Men/Women links in local + timeout paths.
  const [menuNav, dynamicNav] = await fetchNavQuick()

  if (menuNav?.length) {
    settings.config.headerNav = menuNav
  }

  if (dynamicNav?.length) {
    settings.config.headerNav = mergeDynamicMegaMenus(settings.config.headerNav ?? [], dynamicNav)
  }

  return settings
}

const getCachedSettingsProd = unstable_cache(
  fetchSettingsRaw,
  ['splaro-storefront-settings', 'v6-unified-nav'],
  { revalidate: 30, tags: ['storefront-settings', 'storefront-nav'] },
)

function normalizeHref(href: string): string {
  // treat /c/foo and /collections/foo as the same slug
  return href.replace(/^\/(collections|c)\//, '__col__/')
}

function mergeDynamicMegaMenus(nav: NavLink[], apiNav: NavLink[]): NavLink[] {
  const apiByHref = new Map(apiNav.map((item) => [normalizeHref(item.href), item]))
  const apiByLabel = new Map(apiNav.map((item) => [item.label.toLowerCase(), item]))

  return nav.map((item) => {
    const match =
      apiByHref.get(normalizeHref(item.href)) ?? apiByLabel.get(item.label.toLowerCase())
    if (match?.megaMenu) {
      const merged: NavLink = {
        ...item,
        href: match.href || item.href,
        megaMenu: match.megaMenu,
      }
      if (match.hidden !== undefined) merged.hidden = match.hidden
      return merged
    }
    if (item.megaMenu) return item
    return restoreMegaMenus([item])[0] ?? item
  })
}

/** Fill only missing megas — never overwrite live NavBuilder Men/Women trees. */
function restoreMegaMenus(nav: NavLink[]): NavLink[] {
  const fallback = FALLBACK_SETTINGS.config.headerNav ?? []
  return nav.map((item) => {
    if (item.megaMenu?.categories?.length) return item
    const byLabel = fallback.find(
      (entry) => entry.label.toLowerCase() === item.label.toLowerCase(),
    )
    if (byLabel?.megaMenu?.categories?.length) {
      return { ...item, megaMenu: byLabel.megaMenu }
    }
    const byHref = fallback.find(
      (entry) => normalizeHref(entry.href) === normalizeHref(item.href),
    )
    return byHref?.megaMenu?.categories?.length
      ? { ...item, megaMenu: byHref.megaMenu }
      : item
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

/** Men → Women → Kids → Footwear → Accessories among department links only. */
const DEPARTMENT_NAV_RANK: Record<string, number> = {
  men: 0,
  women: 1,
  kids: 2,
  footwear: 3,
  accessories: 4,
}

function departmentNavRank(href: string, label: string): number | null {
  const normalized = normalizeHref(href)
  const labelKey = label.trim().toLowerCase()
  for (const [slug, rank] of Object.entries(DEPARTMENT_NAV_RANK)) {
    if (labelKey === slug) return rank
    if (slug === 'accessories' && (normalized === '/accessories' || normalized.endsWith('/accessories'))) {
      return rank
    }
    if (
      normalized === `/c/${slug}` ||
      normalized === `/collections/${slug}` ||
      normalized.endsWith(`/c/${slug}`) ||
      normalized.endsWith(`/collections/${slug}`)
    ) {
      return rank
    }
  }
  return null
}

function orderDepartmentNavLinks(nav: NavLink[]): NavLink[] {
  const tagged = nav.map((item, index) => ({
    item,
    index,
    rank: departmentNavRank(item.href, item.label),
  }))
  const departments = tagged
    .filter((entry) => entry.rank !== null)
    .sort((a, b) => (a.rank! - b.rank!) || a.index - b.index)
  let deptCursor = 0
  return tagged.map((entry) => {
    if (entry.rank === null) return entry.item
    return departments[deptCursor++]!.item
  })
}

function dynamicNavApplied(nav: NavLink[]): NavLink[] {
  // Per-item fill: Accessories having a mega must NOT skip Men/Women restore.
  return restoreMegaMenus(nav)
}

function applyStoreDefaults(settings: StorefrontSettings): StorefrontSettings {
  const fallbackGroups = FALLBACK_SETTINGS.config.footerGroups ?? []
  const headerNav = settings.config.headerNav?.length
    ? settings.config.headerNav
    : FALLBACK_SETTINGS.config.headerNav
  const normalizedHeaderNav = orderDepartmentNavLinks(
    dynamicNavApplied(
      ensureFallbackNavItems(
        headerNav?.some((item) => item.href === '/')
          ? (headerNav ?? [])
          : [{ label: 'Home', href: '/' }, ...(headerNav ?? [])],
      ),
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
      shopFilters: mergeShopFilters(settings.config.shopFilters ?? FALLBACK_SETTINGS.config.shopFilters),
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

export const getStorefrontSettings = cache(async (): Promise<StorefrontSettings> => {
  try {
    const raw =
      process.env.NODE_ENV === 'development'
        ? await fetchSettingsRaw()
        : await getCachedSettingsProd()
    return applyStoreDefaults(raw)
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[splaro] Storefront settings API unavailable — using bundled defaults. Run: pnpm dev:stack',
        err instanceof Error ? err.message : err,
      )
    }
    return FALLBACK_SETTINGS
  }
})
