'use client'

import '@/styles/pages/cart.css'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import { SplaroBrandLogo } from '@/components/brand/SplaroBrandLogo'
import { MotionLink, MotionPressable } from '@/components/ui/MotionPressable'
import { AnimatePresence, motion } from '@/lib/motion/react'
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react'
import { TopBar } from './TopBar'
import { Navigation } from './Navigation'
import { SearchModal } from './SearchModal'
import { CartDrawer } from '@/components/cart'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { useHeaderScroll, subscribeScroll } from '@/hooks/useScrollY'
import { cn } from '@/lib/utils/cn'

const MobileMenu = dynamic(() => import('./MobileMenu').then((m) => m.MobileMenu))

const DESKTOP_MQ = '(min-width: 1024px)'

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const isHome = pathname === '/'
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const pastHeroRef = useRef(false)

  const cartHydrated = useCartStore((s) => s._hydrated)
  const cartCount = useCartStore((s) => s.itemCount)
  const user = useAuthStore((s) => s.user)
  // Prefer cached user (persist) so guests never wait on /api/auth/me before /login.
  // Match mobile bottom nav — return to account after sign-in.
  const accountHref = user ? '/account' : '/login?next=%2Faccount'
  const {
    isMobileMenuOpen,
    isSearchOpen,
    isCartOpen,
    setMobileMenuOpen,
    setSearchOpen,
    setCartOpen,
  } = useUiStore()

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ)
    const sync = () => setIsDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    // Warm common destinations so first click isn't a multi-second Next compile.
    const routes = [
      '/shop',
      '/c/men',
      '/c/women',
      '/c/kids',
      '/c/footwear',
      '/accessories',
      '/cart',
      '/account',
    ]
    for (const href of routes) router.prefetch(href)
    if (!user) router.prefetch('/login')
  }, [user, router])

  // Hide utility topbar after home hero leaves viewport — DOM-only (no Header re-render).
  // React setState here remounted Navigation mid-scroll and caused click jump / missed taps.
  useEffect(() => {
    const root = document.documentElement
    const clearHeroChrome = () => {
      pastHeroRef.current = false
      root.removeAttribute('data-topbar')
      root.removeAttribute('data-home-hero')
      const topbar = document.querySelector<HTMLElement>('[data-top-bar]')
      const header = document.querySelector<HTMLElement>('[data-header-chrome]')
      topbar?.classList.remove('site-topbar--hidden')
      topbar?.setAttribute('aria-hidden', 'false')
      header?.classList.remove('site-header-glass--topbar-collapsed')
      // Drop IO-owned home chrome so non-home React classes take over cleanly.
      header?.classList.remove('site-header-glass--over-hero')
      header?.classList.remove('site-header-glass--hero-copy-under')
    }

    if (!isHome || !isDesktop) {
      clearHeroChrome()
      return
    }

    let cancelled = false
    let observer: IntersectionObserver | null = null
    let raf = 0
    let unsubScroll: (() => void) | null = null

    const syncHeroCopyUnderNav = () => {
      if (cancelled) return
      if (root.getAttribute('data-scroll-lock') === 'overlay') return
      if (root.getAttribute('data-chrome-pin') === '1') return
      const header = document.querySelector<HTMLElement>('[data-header-chrome]')
      if (!header) return

      // Fully past hero — solid scrolled chrome owns the bar; copy is off-screen.
      if (pastHeroRef.current) {
        header.classList.remove('site-header-glass--hero-copy-under')
        if (root.getAttribute('data-home-hero') !== 'scrolled') {
          root.setAttribute('data-home-hero', 'scrolled')
        }
        return
      }

      // While still over hero, fade copy as soon as eyebrow/title enter the nav band.
      const copy = document.querySelector<HTMLElement>(
        '.home-hero-slider .hero-content .hero-eyebrow, .home-hero-slider .hero-content h1',
      )
      if (!copy) {
        header.classList.remove('site-header-glass--hero-copy-under')
        root.setAttribute('data-home-hero', 'top')
        return
      }

      const headerBottom = header.getBoundingClientRect().bottom
      const copyTop = copy.getBoundingClientRect().top
      const under = copyTop < headerBottom - 2
      header.classList.toggle('site-header-glass--hero-copy-under', under)
      root.setAttribute('data-home-hero', under ? 'mid' : 'top')
    }

    const applyPastHero = (past: boolean) => {
      // Search/menu/cart pin body with position:fixed — that makes the hero
      // "re-intersect" and flips topbar/header chrome (up-down jump). Freeze.
      if (root.getAttribute('data-scroll-lock') === 'overlay') return
      // Search/mega open can race lock by a frame — keep chrome geometry frozen.
      if (root.getAttribute('data-chrome-pin') === '1') return
      if (past === pastHeroRef.current) {
        syncHeroCopyUnderNav()
        return
      }
      pastHeroRef.current = past
      const topbar = document.querySelector<HTMLElement>('[data-top-bar]')
      const header = document.querySelector<HTMLElement>('[data-header-chrome]')

      root.setAttribute('data-topbar', past ? 'hidden' : 'visible')
      root.setAttribute('data-home-hero', past ? 'scrolled' : 'top')
      topbar?.classList.toggle('site-topbar--hidden', past)
      topbar?.setAttribute('aria-hidden', past ? 'true' : 'false')
      header?.classList.toggle('site-header-glass--topbar-collapsed', past)
      header?.classList.toggle('site-header-glass--over-hero', !past)
      header?.classList.toggle('site-header-glass--scrolled', past)
      if (past) header?.classList.remove('site-header-glass--hero-copy-under')
      syncHeroCopyUnderNav()
    }

    const syncFromHeroRect = () => {
      const hero = document.querySelector('.home-hero-slider')
      if (!hero) return
      applyPastHero(hero.getBoundingClientRect().bottom <= 8)
    }

    const attach = () => {
      const hero = document.querySelector('.home-hero-slider')
      if (!hero) {
        raf = window.requestAnimationFrame(attach)
        return
      }

      // Hysteresis via rootMargin: hide a bit earlier, show only when hero is clearly back.
      observer = new IntersectionObserver(
        ([entry]) => {
          if (cancelled || !entry) return
          applyPastHero(!entry.isIntersecting)
        },
        { root: null, threshold: 0, rootMargin: '-8px 0px 0px 0px' },
      )
      observer.observe(hero)
      // Initial sync (e.g. restore scroll position below hero)
      syncFromHeroRect()
      unsubScroll = subscribeScroll(() => {
        syncHeroCopyUnderNav()
      })
    }

    attach()

    // After overlay unlock, body unpins — re-read hero so chrome matches scroll.
    const onLockAttr = (records: MutationRecord[]) => {
      if (cancelled) return
      for (const record of records) {
        if (record.attributeName !== 'data-scroll-lock') continue
        if (root.getAttribute('data-scroll-lock') === 'overlay') return
        syncFromHeroRect()
      }
    }
    const lockObserver = new MutationObserver(onLockAttr)
    lockObserver.observe(root, { attributes: true, attributeFilter: ['data-scroll-lock'] })

    return () => {
      cancelled = true
      if (raf) window.cancelAnimationFrame(raf)
      observer?.disconnect()
      lockObserver.disconnect()
      unsubScroll?.()
      clearHeroChrome()
    }
  }, [isHome, isDesktop])

  const headerPinned =
    isMobileMenuOpen || isSearchOpen || isCartOpen || isMegaMenuOpen

  // Same sticky threshold on every page — shared Header behavior.
  const { isScrolled } = useHeaderScroll(24, headerPinned)
  const forceSolidForSearch = isSearchOpen
  // Mega / search over home hero must not stay transparent — hero bleeds / chrome jitters.
  const forceSolidForMega = isMegaMenuOpen
  const forceSolidChrome = forceSolidForSearch || forceSolidForMega

  // Pin home hero IO while overlays are open (covers the frame before scroll-lock attrs land).
  useLayoutEffect(() => {
    const root = document.documentElement
    if (headerPinned) {
      root.setAttribute('data-chrome-pin', '1')
      return
    }
    root.removeAttribute('data-chrome-pin')
    // Overlay closed — re-sync chrome to real hero rect (same as scroll-lock unlock).
    if (isHome && isDesktop) {
      const hero = document.querySelector('.home-hero-slider')
      if (!hero) return
      const past = hero.getBoundingClientRect().bottom <= 8
      const topbar = document.querySelector<HTMLElement>('[data-top-bar]')
      const header = document.querySelector<HTMLElement>('[data-header-chrome]')
      pastHeroRef.current = past
      root.setAttribute('data-topbar', past ? 'hidden' : 'visible')
      root.setAttribute('data-home-hero', past ? 'scrolled' : 'top')
      topbar?.classList.toggle('site-topbar--hidden', past)
      topbar?.setAttribute('aria-hidden', past ? 'true' : 'false')
      header?.classList.toggle('site-header-glass--topbar-collapsed', past)
      header?.classList.toggle('site-header-glass--over-hero', !past)
      header?.classList.toggle('site-header-glass--scrolled', past)
    }
  }, [headerPinned, isHome, isDesktop])

  // Never set data-home-hero=scrolled until desktop MQ is known — that painted a
  // white topbar flash on every hard reload (isDesktop starts false).
  // First paint: critical CSS + :has(.home-hero-slider) keeps the bar dark.
  useLayoutEffect(() => {
    const root = document.documentElement
    if (!isHome || !isDesktop) {
      root.removeAttribute('data-home-hero')
      return
    }
    // Only seed initial attr if IO hasn't run yet — avoid fighting DOM toggles.
    if (!root.hasAttribute('data-home-hero')) {
      root.setAttribute('data-home-hero', pastHeroRef.current ? 'scrolled' : 'top')
    }
    return () => {
      if (!isHome) root.removeAttribute('data-home-hero')
    }
  }, [isHome, isDesktop])

  // Route change must clear search overlay — otherwise mobile dock stays hidden.
  // Skip same-path remounts (e.g. native→Lenis upgrade) so open search isn't killed.
  const prevPathname = useRef(pathname)
  useEffect(() => {
    if (prevPathname.current === pathname) return
    prevPathname.current = pathname
    setSearchOpen(false)
  }, [pathname, setSearchOpen])

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), [setMobileMenuOpen])
  const closeSearch = useCallback(() => setSearchOpen(false), [setSearchOpen])
  const closeCart = useCallback(() => setCartOpen(false), [setCartOpen])

  const iconBtnClass = 'site-header-glass__icon-btn'
  const mobileSearchActive = isSearchOpen && !isDesktop
  const desktopSearchActive = isSearchOpen && isDesktop

  return (
    <>
      <TopBar />

      <header
        data-site-chrome
        data-header-chrome
        className={cn(
          'site-header-glass z-chrome-header fixed inset-x-0 bottom-auto pt-[env(safe-area-inset-top)]',
          // Home over-hero / scrolled / topbar-collapsed: IntersectionObserver owns via DOM
          // so crossing the hero does not re-render Navigation (avoids click jump).
          !isHome && (isScrolled || forceSolidChrome) && 'site-header-glass--scrolled',
          isHome && isDesktop && !pastHeroRef.current && !forceSolidChrome && 'site-header-glass--over-hero',
          isHome && (forceSolidChrome || pastHeroRef.current) && 'site-header-glass--scrolled',
          isHome && isDesktop && pastHeroRef.current && 'site-header-glass--topbar-collapsed',
          isSearchOpen && 'site-header-glass--search-open',
          isMegaMenuOpen && 'site-header-glass--mega-open',
          desktopSearchActive && 'site-header-glass--search-desktop',
          mobileSearchActive && 'site-header-glass--search-mobile',
        )}
        role="banner"
      >
        <div className="site-header-glass__inner">
          <div className="site-header-glass__row">
            <MotionPressable
              onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
              variant="subtle"
              className={cn(
                iconBtnClass,
                'site-header-glass__menu-btn lg:hidden',
                mobileSearchActive && 'site-header-glass__chrome-hide',
              )}
            >
              {isMobileMenuOpen ? <X strokeWidth={1.55} /> : <Menu strokeWidth={1.55} />}
            </MotionPressable>

            <div
              className={cn(
                'site-header-glass__brand site-header-glass__logo--center-mobile',
                mobileSearchActive && 'site-header-glass__chrome-hide',
              )}
            >
              <SplaroBrandLogo
                href="/"
                size="header"
                tone="light"
                priority
                className="site-header-glass__logo-img splaro-logo-header"
              />
            </div>

            <div
              className={cn(
                'site-header-glass__nav hidden lg:block',
                mobileSearchActive && 'site-header-glass__chrome-hide',
              )}
            >
              <Navigation onMegaMenuChange={setIsMegaMenuOpen} />
            </div>

            <div
              className={cn(
                'site-header-glass__actions',
                isSearchOpen && 'site-header-glass__actions--search',
              )}
            >
              {isSearchOpen ? (
                <SearchModal
                  isOpen={isSearchOpen}
                  onClose={closeSearch}
                  variant={isDesktop ? 'desktop' : 'mobile'}
                />
              ) : (
                <MotionPressable
                  onClick={() => setSearchOpen(true)}
                  aria-label="Search"
                  variant="icon"
                  className={cn(iconBtnClass, 'site-header-glass__action-search')}
                >
                  <Search className="site-header-glass__search-svg" strokeWidth={1.55} />
                </MotionPressable>
              )}

              <MotionLink
                href={accountHref}
                prefetch
                aria-label="Account"
                variant="icon"
                className={cn(
                  iconBtnClass,
                  'site-header-glass__action-desktop',
                  mobileSearchActive && 'site-header-glass__chrome-hide',
                )}
              >
                <User
                  className="site-header-glass__nav-icon site-header-glass__nav-icon--account"
                  strokeWidth={1.5}
                  absoluteStrokeWidth
                />
              </MotionLink>

              {/* Badge is a sibling of the icon button — never a child.
                  backdrop-filter / border-radius on the disk clips overflow
                  children even when overflow:visible (ruined bag circle). */}
              <div
                className={cn(
                  'site-header-glass__action-cart relative hidden lg:inline-flex',
                  mobileSearchActive && 'site-header-glass__chrome-hide',
                )}
              >
                <MotionPressable
                  onClick={() => setCartOpen(true)}
                  aria-label={`Cart (${cartCount} items)`}
                  variant="icon"
                  className={iconBtnClass}
                >
                  <ShoppingBag
                    className="site-header-glass__nav-icon site-header-glass__nav-icon--bag"
                    strokeWidth={1.5}
                    absoluteStrokeWidth
                  />
                </MotionPressable>
                <AnimatePresence>
                  {cartHydrated && cartCount > 0 ? (
                    <motion.span
                      key={cartCount}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}
                      className="site-header-glass__count-badge site-header-glass__count-badge--cart"
                      aria-hidden
                    >
                      {cartCount > 99 ? '99+' : cartCount}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Keep mounted so exit opacity/translate can finish without killing the portal. */}
      <MobileMenu isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
      {/* Always mounted — conditional mount made first bag click feel like a reload/load. */}
      <CartDrawer isOpen={isCartOpen} onClose={closeCart} />
    </>
  )
}
