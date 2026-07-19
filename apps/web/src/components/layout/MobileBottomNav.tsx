'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from '@/lib/motion/react'
import { Home, ShoppingBag, Store, User } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { useUiStore } from '@/store/uiStore'

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

/** Mobile dock: Home · Shop · Bag · Account — equal 4-col */
const BASE_ITEMS = [
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
] as const

const ACCOUNT_MATCH = (path: string) =>
  path.startsWith('/login') || path.startsWith('/signup') || path.startsWith('/account')

/** Logged-out: go straight to /login — never hop /account → spinner → redirect. */
const LOGIN_HREF = '/login?next=%2Faccount'

const dockMotion = {
  hidden: { y: 10, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
  },
  exit: { y: 8, opacity: 0, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] as const } },
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const cartHydrated = useCartStore((state) => state._hydrated)
  const cartCount = useCartStore((state) => state.itemCount)
  const user = useAuthStore((state) => state.user)
  const overlayOpen = useUiStore(
    (state) =>
      state.isMobileMenuOpen ||
      state.isSearchOpen ||
      state.isCartOpen ||
      state.scrollLockCount > 0,
  )
  const [mounted, setMounted] = useState(false)
  const signedIn = Boolean(user)
  const accountHref = signedIn ? '/account' : LOGIN_HREF

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    router.prefetch('/cart')
    if (signedIn) return
    router.prefetch('/login')
    router.prefetch(LOGIN_HREF)
  }, [router, signedIn])

  const hiddenRoute = HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  const visible = mounted && !hiddenRoute && !overlayOpen

  if (!mounted) return null

  const items = [
    ...BASE_ITEMS,
    {
      id: 'account' as const,
      href: accountHref,
      label: 'Account',
      icon: User,
      match: ACCOUNT_MATCH,
    },
  ]

  const activeIndex = items.findIndex((item) => item.match(pathname))

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
            {/* One pill only — CSS translate, no layoutId ghost/glitch */}
            {activeIndex >= 0 ? (
              <span
                className="mobile-bottom-nav__active-pill"
                aria-hidden
                style={{ '--nav-active-i': activeIndex } as CSSProperties}
              />
            ) : null}
            {items.map((item) => {
              const Icon = item.icon
              const active = item.match(pathname)
              const showCartBadge = item.id === 'bag' && cartHydrated && cartCount > 0
              const label = item.id === 'account' && signedIn ? 'You' : item.label

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  prefetch={item.id === 'account' ? true : null}
                  className={cn(
                    'mobile-bottom-nav__item',
                    active && 'mobile-bottom-nav__item--active',
                  )}
                  aria-current={active ? 'page' : undefined}
                  aria-label={
                    showCartBadge ? `${item.label}, ${cartCount} in bag` : item.label
                  }
                >
                  <span className="mobile-bottom-nav__icon-wrap">
                    <Icon className="mobile-bottom-nav__icon" strokeWidth={active ? 2.25 : 1.7} />
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
