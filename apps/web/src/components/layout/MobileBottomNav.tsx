'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Home, ShoppingBag, Store, User } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { useUiStore } from '@/store/uiStore'
import { useWishlistStore } from '@/store/wishlistStore'

const HIDDEN_PREFIXES = ['/login', '/signup', '/forgot-password', '/reset-password', '/checkout']

const SHOP_PREFIXES = [
  '/shop',
  '/collections',
  '/c/',
  '/products/',
  '/search',
  '/best-sellers',
  '/new-arrivals',
  '/accessories',
  '/footwear',
]

const items = [
  { id: 'home', href: '/', label: 'Home', icon: Home, match: (path: string) => path === '/' },
  {
    id: 'shop',
    href: '/shop',
    label: 'Shop',
    icon: Store,
    match: (path: string) => SHOP_PREFIXES.some((prefix) => path.startsWith(prefix)),
  },
  {
    id: 'bag',
    href: '/cart',
    label: 'Bag',
    icon: ShoppingBag,
    match: (path: string) => path === '/cart' || path.startsWith('/cart/'),
  },
  {
    id: 'wishlist',
    href: '/account?tab=wishlist',
    label: 'Saved',
    icon: Heart,
    match: (path: string, tab: string | null) =>
      path.startsWith('/account') && tab === 'wishlist',
  },
  {
    id: 'account',
    href: '/account',
    label: 'Account',
    icon: User,
    match: (path: string, tab: string | null) =>
      path.startsWith('/login') ||
      path.startsWith('/signup') ||
      (path.startsWith('/account') && tab !== 'wishlist'),
  },
]

const dockMotion = {
  hidden: { y: 28, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', damping: 26, stiffness: 280, mass: 0.82 },
  },
  exit: { y: 20, opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab')
  const wishlistHydrated = useWishlistStore((state) => state._hydrated)
  const wishlistCount = useWishlistStore((state) => state.productIds.length)
  const cartHydrated = useCartStore((state) => state._hydrated)
  const cartCount = useCartStore((state) => state.itemCount)
  const authHydrated = useAuthStore((state) => state._hydrated)
  const user = useAuthStore((state) => state.user)
  const overlayOpen = useUiStore(
    (state) => state.isMobileMenuOpen || state.isSearchOpen || state.isCartOpen,
  )
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const hiddenRoute = HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  const visible = mounted && !hiddenRoute && !overlayOpen

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {visible ? (
        <motion.nav
          key="mobile-bottom-nav"
          data-mobile-bottom-nav
          aria-label="Mobile navigation"
          className="mobile-bottom-nav lg:hidden"
          initial="hidden"
          animate="show"
          exit="exit"
          variants={dockMotion}
        >
          <div className="mobile-bottom-nav__inner">
            {items.map((item) => {
              const Icon = item.icon
              const active = item.match(pathname, tab)
              const showWishlistBadge =
                item.id === 'wishlist' && wishlistHydrated && wishlistCount > 0
              const showCartBadge = item.id === 'bag' && cartHydrated && cartCount > 0
              const label =
                item.id === 'account' && authHydrated && user ? 'You' : item.label

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    'mobile-bottom-nav__item',
                    active && 'mobile-bottom-nav__item--active',
                  )}
                  aria-current={active ? 'page' : undefined}
                  aria-label={
                    showCartBadge ? `${item.label}, ${cartCount} in bag` : item.label
                  }
                >
                  {active ? (
                    <motion.span
                      layoutId="mobile-nav-active-pill"
                      className="mobile-bottom-nav__active-pill"
                      transition={{ type: 'spring', damping: 28, stiffness: 320, mass: 0.75 }}
                    />
                  ) : null}
                  <span className="mobile-bottom-nav__icon-wrap">
                    <Icon className="mobile-bottom-nav__icon" strokeWidth={active ? 2.2 : 1.65} />
                    {showWishlistBadge ? (
                      <span className="mobile-bottom-nav__badge">
                        {wishlistCount > 99 ? '99+' : wishlistCount}
                      </span>
                    ) : null}
                    {showCartBadge ? (
                      <span className="mobile-bottom-nav__badge mobile-bottom-nav__badge--cart">
                        {cartCount > 99 ? '99+' : cartCount}
                      </span>
                    ) : null}
                  </span>
                  <span className="mobile-bottom-nav__label">{label}</span>
                </Link>
              )
            })}
          </div>
        </motion.nav>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
