'use client'

import { useEffect, useState, type SVGProps } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from '@/lib/motion/react'
import { DURATION, EASE_EXPO_OUT, EXIT } from '@/lib/motion/config'
import { cn } from '@/lib/utils/cn'
import { BagIcon } from '@/components/product/AddToBagIcon'
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

type NavIconProps = SVGProps<SVGSVGElement> & { active?: boolean }

/** ILYN-style: light dock, no black pill — solid ink when active, soft outline when idle. */
function HomeNavIcon({ active, ...props }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <path
        d="M4.6 10.7 12 4.9l7.4 5.8V19a1.2 1.2 0 0 1-1.2 1.2h-3.5v-4.8h-5.4V20.2H5.8A1.2 1.2 0 0 1 4.6 19V10.7Z"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'}
      />
    </svg>
  )
}

/** Boutique storefront — peaked roof + arched door. */
function ShopNavIcon({ active, ...props }: NavIconProps) {
  const cut = active ? '#f7f7f8' : 'currentColor'
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <path
        d="M4.4 10.1 12 4.6l7.6 5.5"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.55 10.1h12.9v8.35a1.25 1.25 0 0 1-1.25 1.25H6.8a1.25 1.25 0 0 1-1.25-1.25V10.1Z"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'}
      />
      <path
        d="M9.55 19.7v-5.05a2.45 2.45 0 0 1 4.9 0V19.7"
        stroke={cut}
        strokeWidth={1.7}
        strokeLinecap="round"
        fill={active ? cut : 'none'}
      />
      <path
        d="M7.15 12.35h2.05M14.8 12.35h2.05"
        stroke={cut}
        strokeWidth={1.55}
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Shared luxury tote — solid fill + dock-cut handle when active. */
function BagNavIcon({ active, className }: NavIconProps) {
  return (
    <BagIcon
      size={22}
      strokeWidth={1.7}
      filled={Boolean(active)}
      cutColor="#f7f7f8"
      {...(className ? { className } : {})}
    />
  )
}

function AccountNavIcon({ active, ...props }: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <circle
        cx="12"
        cy="8.1"
        r="3.05"
        stroke="currentColor"
        strokeWidth={1.7}
        fill={active ? 'currentColor' : 'none'}
      />
      <path
        d="M5.8 18.85c.85-2.7 2.95-4.15 6.2-4.15s5.35 1.45 6.2 4.15"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        fill={active ? 'currentColor' : 'none'}
      />
    </svg>
  )
}

/** Mobile dock: Home · Shop · Bag · Account — equal 4-col */
const BASE_ITEMS = [
  { id: 'home', href: '/', label: 'Home', icon: HomeNavIcon, match: (path: string) => path === '/' },
  {
    id: 'shop',
    href: '/shop',
    label: 'Shop',
    icon: ShopNavIcon,
    match: (path: string) => SHOP_PREFIXES.some((prefix) => path.startsWith(prefix)),
  },
  {
    id: 'bag',
    href: '/cart',
    label: 'Bag',
    icon: BagNavIcon,
    match: (path: string) => path === '/cart' || path.startsWith('/cart/'),
  },
] as const

const ACCOUNT_MATCH = (path: string) =>
  path.startsWith('/login') || path.startsWith('/signup') || path.startsWith('/account')

/** Logged-out: go straight to /login — never hop /account → spinner → redirect. */
const LOGIN_HREF = '/login?next=%2Faccount'

const dockMotion = {
  hidden: { y: 4, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { duration: DURATION.fast, ease: EASE_EXPO_OUT },
  },
  exit: { y: 4, opacity: 0, transition: EXIT },
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
    ...BASE_ITEMS,
    {
      id: 'account' as const,
      href: accountHref,
      label: 'Account',
      icon: AccountNavIcon,
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
          <div className="mobile-bottom-nav__inner">
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
                    <Icon className="mobile-bottom-nav__icon" active={active} />
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
