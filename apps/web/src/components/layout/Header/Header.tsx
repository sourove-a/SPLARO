'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { SplaroBrandLogo } from '@/components/brand/SplaroBrandLogo'
import { MotionLink, MotionPressable } from '@/components/ui/MotionPressable'
import { AnimatePresence, motion } from '@/lib/motion/react'
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react'
import { TopBar } from './TopBar'
import { Navigation } from './Navigation'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { useUiStore } from '@/store/uiStore'
import { useHeaderScroll } from '@/hooks/useScrollY'
import { cn } from '@/lib/utils/cn'
import { isTouchUiViewport } from '@/lib/hooks/use-mobile-viewport'

const MobileMenu = dynamic(() => import('./MobileMenu').then((m) => m.MobileMenu))
const CartDrawer = dynamic(() => import('@/components/cart').then((m) => m.CartDrawer))
const SearchModal = dynamic(() => import('./SearchModal').then((m) => m.SearchModal))

export function Header() {
  const pathname = usePathname()
  const isHome = pathname === '/'
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false)

  const cartHydrated = useCartStore((s) => s._hydrated)
  const cartCount = useCartStore((s) => s.itemCount)
  const wishlistHydrated = useWishlistStore((s) => s._hydrated)
  const wishlistCount = useWishlistStore((s) => s.productIds.length)
  const authHydrated = useAuthStore((s) => s._hydrated)
  const user = useAuthStore((s) => s.user)
  const {
    isMobileMenuOpen,
    isSearchOpen,
    isCartOpen,
    setMobileMenuOpen,
    setSearchOpen,
    setCartOpen,
  } = useUiStore()

  const headerPinned =
    isMobileMenuOpen || isSearchOpen || isCartOpen || isMegaMenuOpen

  const { isScrolled } = useHeaderScroll(isHome ? 60 : 24, headerPinned)
  const isOverHero = isHome && !isScrolled

  useEffect(() => {
    const root = document.documentElement
    if (!isHome) {
      root.removeAttribute('data-home-hero')
      return
    }
    root.setAttribute('data-home-hero', isOverHero ? 'top' : 'scrolled')
    return () => root.removeAttribute('data-home-hero')
  }, [isHome, isOverHero])

  // Desktop only: warm search thumbs while idle. Skip homepage — SSR preview already loaded.
  useEffect(() => {
    if (isHome || isTouchUiViewport()) return
    const controller = new AbortController()
    const warm = () => {
      void fetch('/api/products?limit=48', {
        cache: 'force-cache',
        signal: controller.signal,
      }).catch(() => {})
    }
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (win.requestIdleCallback) {
      const id = win.requestIdleCallback(warm, { timeout: 2500 })
      return () => {
        win.cancelIdleCallback?.(id)
        controller.abort()
      }
    }
    const t = window.setTimeout(warm, 1200)
    return () => {
      window.clearTimeout(t)
      controller.abort()
    }
  }, [isHome])

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), [setMobileMenuOpen])
  const closeSearch = useCallback(() => setSearchOpen(false), [setSearchOpen])
  const closeCart = useCallback(() => setCartOpen(false), [setCartOpen])

  const iconBtnClass = 'site-header-glass__icon-btn'

  return (
    <>
      <TopBar />

      <header
        data-site-chrome
        data-header-chrome
        className={cn(
          'site-header-glass z-chrome-header fixed inset-x-0 bottom-auto pt-[env(safe-area-inset-top)]',
          isOverHero && 'site-header-glass--over-hero',
          isScrolled && 'site-header-glass--scrolled',
        )}
        role="banner"
      >
        <div className="site-header-glass__inner">
          <div className="site-header-glass__row">
            <MotionPressable
              onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
              variant="nav"
              className={cn(iconBtnClass, 'site-header-glass__menu-btn lg:hidden')}
            >
              <AnimatePresence mode="wait" initial={false}>
                {isMobileMenuOpen ? (
                  <motion.span
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <X strokeWidth={1.35} />
                  </motion.span>
                ) : (
                  <motion.span
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Menu strokeWidth={1.35} />
                  </motion.span>
                )}
              </AnimatePresence>
            </MotionPressable>

            <div className="site-header-glass__brand site-header-glass__logo--center-mobile">
              <SplaroBrandLogo
                href="/"
                size="header"
                tone="light"
                priority
                className="site-header-glass__logo-img splaro-logo-header"
              />
            </div>

            <div className="site-header-glass__nav hidden lg:block">
              <Navigation onMegaMenuChange={setIsMegaMenuOpen} />
            </div>

            <div className="site-header-glass__actions">
              <MotionPressable
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
                variant="icon"
                className={cn(iconBtnClass, 'site-header-glass__action-search')}
              >
                <Search strokeWidth={1.35} />
              </MotionPressable>

              <MotionLink
                href={authHydrated && user ? '/account' : '/login'}
                aria-label="Account"
                variant="icon"
                className={cn(iconBtnClass, 'site-header-glass__action-desktop')}
              >
                <User strokeWidth={1.55} />
              </MotionLink>

              <MotionLink
                href="/account?tab=wishlist"
                aria-label="Wishlist"
                variant="icon"
                className={cn(iconBtnClass, 'site-header-glass__action-desktop')}
              >
                <Heart strokeWidth={1.55} />
                {wishlistHydrated && wishlistCount > 0 ? (
                  <span className="site-header-glass__count-badge">
                    {wishlistCount > 99 ? '99+' : wishlistCount}
                  </span>
                ) : null}
              </MotionLink>

              <MotionPressable
                onClick={() => setCartOpen(true)}
                aria-label={`Cart (${cartCount} items)`}
                variant="icon"
                className={cn(iconBtnClass, 'site-header-glass__action-cart relative hidden lg:inline-flex')}
              >
                <ShoppingBag strokeWidth={1.55} />
                {cartHydrated && cartCount > 0 ? (
                  <span className="site-header-glass__count-badge site-header-glass__count-badge--cart">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                ) : null}
              </MotionPressable>
            </div>
          </div>
        </div>
      </header>

      {isMobileMenuOpen ? (
        <MobileMenu isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
      ) : null}
      {isSearchOpen ? <SearchModal isOpen={isSearchOpen} onClose={closeSearch} /> : null}
      {isCartOpen ? <CartDrawer isOpen={isCartOpen} onClose={closeCart} /> : null}
    </>
  )
}
