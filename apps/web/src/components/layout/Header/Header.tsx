'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SplaroBrandLogo, logoUrlProp } from '@/components/brand/SplaroBrandLogo'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react'
import { TopBar } from './TopBar'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { useUiStore } from '@/store/uiStore'
import { useStorefrontSettings } from '@/components/providers/StorefrontSettingsProvider'
import { useHeaderScroll } from '@/hooks/useScrollY'
import { useMinWidth } from '@/lib/hooks/use-mobile-viewport'
import { cn } from '@/lib/utils/cn'

const DesktopNavigation = dynamic(() => import('./Navigation').then((m) => m.Navigation), {
  ssr: false,
})
const MobileMenu = dynamic(() => import('./MobileMenu').then((m) => m.MobileMenu))
const SearchModal = dynamic(() => import('./SearchModal').then((m) => m.SearchModal))
const CartDrawer = dynamic(() => import('@/components/cart').then((m) => m.CartDrawer))

export function Header() {
  const pathname = usePathname()
  const isDesktopNav = useMinWidth(1024)
  const [desktopNavReady, setDesktopNavReady] = useState(false)
  const isHome = pathname === '/'
  const settings = useStorefrontSettings()
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
    if (isDesktopNav) setDesktopNavReady(true)
  }, [isDesktopNav])

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), [setMobileMenuOpen])
  const closeSearch = useCallback(() => setSearchOpen(false), [setSearchOpen])
  const closeCart = useCallback(() => setCartOpen(false), [setCartOpen])

  useEffect(() => {
    const root = document.documentElement
    if (!isHome) {
      root.removeAttribute('data-home-hero')
      return
    }
    root.setAttribute('data-home-hero', isOverHero ? 'top' : 'scrolled')
    return () => root.removeAttribute('data-home-hero')
  }, [isHome, isOverHero])

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
            <button
              onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
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
            </button>

            <div className="site-header-glass__brand site-header-glass__logo--center-mobile">
              <SplaroBrandLogo
                href="/"
                size="header"
                tone="light"
                priority
                className="site-header-glass__logo-img splaro-logo-header"
                {...logoUrlProp(settings.store.logo)}
              />
            </div>

            {desktopNavReady ? (
              <DesktopNavigation onMegaMenuChange={setIsMegaMenuOpen} />
            ) : null}

            <div className="site-header-glass__actions">
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
                className={cn(iconBtnClass, 'site-header-glass__action-search')}
              >
                <Search strokeWidth={1.35} />
              </button>

              <Link
                href={authHydrated && user ? '/account' : '/login'}
                aria-label="Account"
                className={cn(iconBtnClass, 'site-header-glass__action-desktop')}
              >
                <User strokeWidth={1.55} />
              </Link>

              <Link
                href="/account?tab=wishlist"
                aria-label="Wishlist"
                className={cn(iconBtnClass, 'site-header-glass__action-desktop')}
              >
                <Heart strokeWidth={1.55} />
                {wishlistHydrated && wishlistCount > 0 ? (
                  <span className="site-header-glass__count-badge">
                    {wishlistCount > 99 ? '99+' : wishlistCount}
                  </span>
                ) : null}
              </Link>

              <button
                onClick={() => setCartOpen(true)}
                aria-label={`Cart (${cartCount} items)`}
                className={cn(iconBtnClass, 'site-header-glass__action-cart relative hidden lg:inline-flex')}
              >
                <ShoppingBag strokeWidth={1.55} />
                {cartHydrated && cartCount > 0 ? (
                  <span className="site-header-glass__count-badge site-header-glass__count-badge--cart">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                ) : null}
              </button>
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
