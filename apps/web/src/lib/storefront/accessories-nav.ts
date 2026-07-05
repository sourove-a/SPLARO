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

export const ACCESSORIES_MEGA_HEROES = [
  {
    label: 'Eyewear Edit',
    href: '/accessories?cat=glasses',
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=88&auto=format&fit=crop',
  },
  {
    label: 'New Arrivals',
    href: '/accessories?filter=new',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=88&auto=format&fit=crop',
  },
  {
    label: 'Bestsellers',
    href: '/accessories?filter=bestsellers',
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=88&auto=format&fit=crop',
  },
] as const
