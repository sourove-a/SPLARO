import type { MegaMenuCategory } from '@/lib/storefront/settings'

/** Shared accessories categories — mega menu, mobile nav, and /accessories page. */
export const ACCESSORIES_FILTER_CATEGORIES = [
  { id: 'all', label: 'All', emoji: '✦', href: '/accessories' },
  { id: 'glasses', label: 'Glasses', emoji: '👓', href: '/accessories?cat=glasses' },
  { id: 'watches', label: 'Watches', emoji: '⌚', href: '/accessories?cat=watches' },
  { id: 'bags', label: 'Bags', emoji: '👜', href: '/accessories?cat=bags' },
  { id: 'handbags', label: 'Handbags', emoji: '👛', href: '/accessories?cat=handbags' },
  { id: 'jewelry', label: 'Jewelry', emoji: '💎', href: '/accessories?cat=jewelry' },
  { id: 'wallets', label: 'Wallets', emoji: '💳', href: '/accessories?cat=wallets' },
  { id: 'scarves', label: 'Scarves', emoji: '🧣', href: '/accessories?cat=scarves' },
  { id: 'belts', label: 'Belts', emoji: '👔', href: '/accessories?cat=belts' },
  { id: 'hats', label: 'Hats', emoji: '👒', href: '/accessories?cat=hats' },
  { id: 'prayer-caps', label: 'Prayer Caps', emoji: '🕌', href: '/accessories?cat=prayer-caps' },
  { id: 'home-decor', label: 'Home Decor', emoji: '🏠', href: '/accessories?cat=home-decor' },
] as const

export type AccessoriesFilterId = (typeof ACCESSORIES_FILTER_CATEGORIES)[number]['id']

/** Mega menu column structure — synced with header nav. */
export const ACCESSORIES_MEGA_CATEGORIES: MegaMenuCategory[] = [
  {
    label: 'Glasses',
    href: '/accessories?cat=glasses',
    icon: 'Glasses',
    subcategories: [
      { label: 'Sunglasses', href: '/accessories?cat=glasses-sunglasses' },
      { label: 'Optical', href: '/accessories?cat=glasses-optical' },
      { label: 'Aviator', href: '/accessories?cat=glasses-aviator' },
      { label: 'Cat-Eye', href: '/accessories?cat=glasses-cat-eye' },
    ],
  },
  {
    label: 'Bags',
    href: '/accessories?cat=bags',
    icon: 'ShoppingBag',
    subcategories: [
      { label: 'All', href: '/accessories?cat=bags' },
      { label: 'Premium', href: '/accessories?cat=bags-premium' },
      { label: 'Luxury', href: '/accessories?cat=bags-luxury' },
      { label: 'W&S', href: '/accessories?cat=bags-ws' },
    ],
  },
  {
    label: 'Handbags',
    href: '/accessories?cat=handbags',
    icon: 'Backpack',
    subcategories: [
      { label: 'Tote', href: '/accessories?cat=handbags-tote' },
      { label: 'Shoulder', href: '/accessories?cat=handbags-shoulder' },
      { label: 'Clutch', href: '/accessories?cat=clutch' },
    ],
  },
  { label: 'Watches', href: '/accessories?cat=watches', icon: 'Watch' },
  { label: 'Wallets', href: '/accessories?cat=wallets', icon: 'Wallet' },
  { label: 'Cardholder', href: '/accessories?cat=cardholder', icon: 'CreditCard' },
  { label: 'Jewelry', href: '/accessories?cat=jewelry', icon: 'Gem' },
  { label: 'Prayer Caps', href: '/accessories?cat=prayer-caps', icon: 'CircleDot' },
  { label: 'Prayer Mats', href: '/accessories?cat=prayer-mats', icon: 'BookOpen' },
  { label: 'Home Decor', href: '/accessories?cat=home-decor', icon: 'Lamp' },
]

type AccessoriesNavItem = {
  label?: string
  href: string
  hidden?: boolean
  megaMenu?: { categories?: unknown[]; heroes?: unknown[] }
}

function accessoriesPath(href: string) {
  return href.split(/[?#]/, 1)[0]?.replace(/\/$/, '') || '/'
}

function isAccessoriesNavItem(item: AccessoriesNavItem) {
  const href = accessoriesPath(item.href ?? '')
  const label = item.label?.trim().toLowerCase() ?? ''
  return (
    href === '/accessories' ||
    href === '/c/accessories' ||
    href === '/collections/accessories' ||
    label === 'accessories'
  )
}

function isInventedAccessoriesMegaHref(href: string) {
  return accessoriesPath(href) === '/accessories' && /[?&]cat=/.test(href)
}

function stripInventedAccessoriesMega<T extends AccessoriesNavItem>(item: T): T {
  const cats = item.megaMenu?.categories
  if (!Array.isArray(cats) || cats.length === 0) return item
  const kept = cats.filter((cat) => {
    if (!cat || typeof cat !== 'object' || !('href' in cat)) return true
    return !isInventedAccessoriesMegaHref(String((cat as { href?: string }).href ?? ''))
  })
  if (kept.length === cats.length) return item
  if (kept.length === 0) return { ...item, megaMenu: undefined }
  return { ...item, megaMenu: { ...item.megaMenu, categories: kept } }
}

/**
 * Keep the Accessories header link canonical — do not invent empty mega columns.
 * Empty categories are hidden by NavBuilder (`hideEmptyCategories`); refilling
 * the dropdown here made Glasses/Bags/… show with zero products.
 */
export function healAccessoriesHeaderNav<T extends AccessoriesNavItem>(nav: T[]): T[] {
  const idx = nav.findIndex(isAccessoriesNavItem)
  if (idx >= 0) {
    const item = nav[idx]!
    if (item.hidden) return nav
    const stripped = stripInventedAccessoriesMega(item)
    const href = accessoriesPath(stripped.href) === '/accessories' ? stripped.href : '/accessories'
    if (href === item.href && stripped === item) return nav
    const next = [...nav]
    next[idx] = href === stripped.href ? stripped : { ...stripped, href }
    return next
  }

  const link = { label: 'Accessories', href: '/accessories' } as T
  const footwearIdx = nav.findIndex((item) => {
    const href = accessoriesPath(item.href ?? '')
    return (
      href === '/c/footwear' ||
      href === '/collections/footwear' ||
      item.label?.trim().toLowerCase() === 'footwear'
    )
  })
  if (footwearIdx >= 0) {
    const next = [...nav]
    next.splice(footwearIdx + 1, 0, link)
    return next
  }
  return [...nav, link]
}
