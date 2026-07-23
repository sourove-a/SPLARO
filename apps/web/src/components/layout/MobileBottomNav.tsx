'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, ShoppingBag, Store, User } from 'lucide-react'
import { PremiumIcon } from '@/components/ui/PremiumIcon'
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from '@/lib/motion/react'
import { DURATION, EASE_EXPO_OUT, EXIT, GENTLE } from '@/lib/motion/config'
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

const springQuiet = GENTLE

const dockMotion = {
  hidden: { y: 6, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { duration: DURATION.fast, ease: EASE_EXPO_OUT },
  },
  exit: { y: 6, opacity: 0, transition: EXIT },
}

const NAV_ITEMS_BASE = [
  {
    id: 'home' as const,
    href: '/',
    label: 'Home',
    Icon: Home,
    match: (path: string) => path === '/',
  },
  {
    id: 'shop' as const,
    href: '/shop',
    label: 'Shop',
    Icon: Store,
    match: (path: string) => SHOP_PREFIXES.some((prefix) => path.startsWith(prefix)),
  },
  {
    id: 'bag' as const,
    href: '/cart',
    label: 'Bag',
    Icon: ShoppingBag,
    match: (path: string) => path === '/cart' || path.startsWith('/cart/'),
  },
]

const ACCOUNT_MATCH = (path: string) =>
  path.startsWith('/login') || path.startsWith('/signup') || path.startsWith('/account')

/** Logged-out: go straight to /login — never hop /account → spinner → redirect. */
const LOGIN_HREF = '/login?next=%2Faccount'

export function MobileBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const reduceMotion = useReducedMotion()
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
    router.prefetch('/shop')
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
    ...NAV_ITEMS_BASE,
    {
      id: 'account' as const,
      href: accountHref,
      label: 'Account',
      Icon: User,
      match: ACCOUNT_MATCH,
    },
  ]

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
          <LayoutGroup id="mobile-bottom-nav">
            <div className="mobile-bottom-nav__inner">
              {items.map((item) => {
                const { Icon } = item
                const active = item.match(pathname)
                const showCartBadge = item.id === 'bag' && cartHydrated && cartCount > 0

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
                    {active ? (
                      <motion.span
                        layoutId="mobile-nav-active-capsule"
                        className="mobile-bottom-nav__capsule"
                        transition={reduceMotion ? { duration: 0 } : springQuiet}
                        aria-hidden
                      />
                    ) : null}

                    <motion.span
                      className="mobile-bottom-nav__icon-wrap"
                      animate={
                        reduceMotion
                          ? { y: 0, scale: 1, opacity: 1 }
                          : {
                              y: active ? -2 : 0,
                              scale: active ? 1.03 : 1,
                              opacity: 1,
                            }
                      }
                      transition={reduceMotion ? { duration: 0 } : springQuiet}
                    >
                      <PremiumIcon
                        icon={Icon}
                        size="sm"
                        active={active}
                        className="mobile-bottom-nav__premium-icon"
                      />
                      {showCartBadge ? (
                        <span className="mobile-bottom-nav__badge" aria-hidden>
                          {cartCount > 99 ? '99+' : cartCount}
                        </span>
                      ) : null}
                    </motion.span>

                    <motion.span
                      className="mobile-bottom-nav__label"
                      animate={{ opacity: active ? 1 : 0.72 }}
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { duration: DURATION.fast, ease: EASE_EXPO_OUT }
                      }
                    >
                      {item.label}
                    </motion.span>
                  </Link>
                )
              })}
            </div>
          </LayoutGroup>
        </motion.nav>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
