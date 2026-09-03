'use client'

import { Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { SmoothScroll } from '@/components/layout/SmoothScroll'
import { StorefrontPresence } from '@/components/layout/StorefrontPresence'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { LeaveHomeChromeSnap } from '@/components/layout/LeaveHomeChromeSnap'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
import { hardNavigate } from '@/lib/navigation/safe-client-navigate'

const FloatingSystem = dynamic(
  () => import('@/components/layout/FloatingSystem').then((m) => m.FloatingSystem),
  { ssr: false },
)

const AUTH_PATH_PREFIXES = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email']
const HEADER_ONLY_PATHS = ['/design/header']
const CHROMELESS_PATHS = ['/maintenance']

function isFunnelDomain(): boolean {
  if (typeof window === 'undefined') return false
  const host = (window.location.host.split(':')[0] || '').toLowerCase()
  if (host.endsWith('.localhost')) return true
  return Boolean(
    host &&
    host !== 'splaro.co' &&
    host !== 'www.splaro.co' &&
    host !== 'localhost' &&
    host !== '127.0.0.1' &&
    !host.startsWith('192.168.')
  )
}

function isChromelessPath(pathname: string): boolean {
  if (isFunnelDomain()) return true
  return (
    CHROMELESS_PATHS.includes(pathname) ||
    pathname === '/funnel' ||
    pathname.startsWith('/funnel/')
  )
}
/** Focused flows — earth footer intrudes on short utility pages. */
const FOOTERLESS_PATHS = ['/cart', '/checkout', '/account']
/** Checkout owns its chrome — no site header/menu/search competing with Place order. */
const CHECKOUT_FOCUS_PATHS = ['/checkout']
/** These route components already own their semantic <main>. */
const SELF_MAIN_PATHS = ['/account', '/collections', '/track-order', '/checkout', '/payment']

function isFooterlessPath(pathname: string): boolean {
  return FOOTERLESS_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function isCheckoutFocusPath(pathname: string): boolean {
  return CHECKOUT_FOCUS_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function isAuthPath(pathname: string): boolean {
  return AUTH_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function isHeaderOnlyPath(pathname: string): boolean {
  return HEADER_ONLY_PATHS.includes(pathname)
}

function hasSelfMain(pathname: string): boolean {
  return (
    SELF_MAIN_PATHS.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ) || pathname.startsWith('/order-confirmation/')
  )
}

/**
 * Soft-nav to /login updates pathname before the (auth) RSC tree arrives, so
 * StorefrontChrome would briefly paint the previous page (e.g. Track Order)
 * without header chrome. Hold until `.auth-shell` mounts — never flash old UI.
 * If RSC stalls (dev 503), hard-navigate after a short grace period.
 */
function AuthRoutePaintGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const childrenRef = useRef<HTMLDivElement>(null)
  // Start held so soft-nav never paints the previous route first.
  const [ready, setReady] = useState(false)
  const prevPathRef = useRef(pathname)

  useLayoutEffect(() => {
    const root = childrenRef.current
    if (!root) return

    const sync = () => {
      setReady(Boolean(root.querySelector('.auth-shell')))
    }
    sync()
    const mo = new MutationObserver(sync)
    mo.observe(root, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [pathname])

  // Soft-nav within auth (login ↔ signup?phone=1) — shell never unmounts.
  // Keep ready so phone step never flashes the empty shimmer / white card.
  useLayoutEffect(() => {
    const prev = prevPathRef.current
    prevPathRef.current = pathname
    if (prev === pathname) return
    if (isAuthPath(prev) && isAuthPath(pathname) && childrenRef.current?.querySelector('.auth-shell')) {
      setReady(true)
    }
  }, [pathname])

  useEffect(() => {
    if (ready) return
    const timer = window.setTimeout(() => {
      // If the real shell mounted but the observer missed it, unblock paint
      // instead of leaving the shimmer forever (looks like a white screen).
      if (childrenRef.current?.querySelector('.auth-shell')) {
        setReady(true)
        return
      }
      hardNavigate(pathname)
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [ready, pathname])

  return (
    <div className="auth-route-paint-guard">
      {!ready ? (
        <main className="auth-shell auth-template-enter" tabIndex={-1}>
          <div className="auth-shell__glow" aria-hidden="true" />
          <div className="auth-shell__inner">
            <div className="auth-glass-panel">
              <div className="auth-glass-panel__shine" aria-hidden="true" />
              <div className="auth-card auth-card--loading" aria-busy="true" aria-label="Loading sign in" />
            </div>
          </div>
        </main>
      ) : null}
      <div
        ref={childrenRef}
        hidden={!ready}
        aria-hidden={!ready}
        style={!ready ? { display: 'none' } : undefined}
      >
        {children}
      </div>
    </div>
  )
}

function StorefrontChromeInner({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isAuth = isAuthPath(pathname)
  const isHeaderOnly = isHeaderOnlyPath(pathname)
  const isChromeless = isChromelessPath(pathname)
  const hideFooter = isFooterlessPath(pathname)
  const selfMain = hasSelfMain(pathname)

  if (isChromeless) {
    return <>{children}</>
  }

  if (isAuth) {
    return <AuthRoutePaintGuard>{children}</AuthRoutePaintGuard>
  }

  if (isCheckoutFocusPath(pathname)) {
    return (
      <SmoothScroll>
        <div id="main-content" className="checkout-focus-root" tabIndex={-1}>
          {children}
        </div>
      </SmoothScroll>
    )
  }

  if (isHeaderOnly) {
    return (
      <SmoothScroll>
        <Header />
        <main
          id="main-content"
          className="min-h-screen bg-[var(--bg-primary)]"
          aria-hidden
          tabIndex={-1}
        />
      </SmoothScroll>
    )
  }

  return (
    <SmoothScroll>
      <LeaveHomeChromeSnap />
      <Header />
      {selfMain ? (
        <div
          id="main-content"
          className={
            hideFooter ? 'main-with-mobile-nav' : 'main-with-mobile-nav main-with-footer'
          }
          tabIndex={-1}
        >
          {children}
        </div>
      ) : (
        <main
          id="main-content"
          className={
            hideFooter
              ? 'main-with-mobile-nav main-utility-page'
              : 'main-with-mobile-nav main-with-footer'
          }
          tabIndex={-1}
        >
          {children}
        </main>
      )}
      {hideFooter ? null : <Footer />}
      <Suspense fallback={null}>
        <MobileBottomNav />
      </Suspense>
      <FloatingSystem />
    </SmoothScroll>
  )
}

export function StorefrontChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (isChromelessPath(pathname)) {
    return <>{children}</>
  }

  return (
    <>
      <Suspense fallback={null}>
        <StorefrontPresence />
      </Suspense>
      <Suspense fallback={<>{children}</>}>
        <StorefrontChromeInner>{children}</StorefrontChromeInner>
      </Suspense>
    </>
  )
}
