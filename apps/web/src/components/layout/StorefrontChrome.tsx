'use client'

import { Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { SmoothScroll } from '@/components/layout/SmoothScroll'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
import { hardNavigate } from '@/lib/navigation/safe-client-navigate'

const FloatingSystem = dynamic(
  () => import('@/components/layout/FloatingSystem').then((m) => m.FloatingSystem),
  { ssr: false },
)

const AUTH_PATH_PREFIXES = ['/login', '/signup', '/forgot-password', '/reset-password']
const HEADER_ONLY_PATHS = ['/design/header']
const CHROMELESS_PATHS = ['/maintenance']
/** Focused flows — earth footer intrudes on short utility pages. */
const FOOTERLESS_PATHS = ['/cart', '/checkout', '/account']
/** These route components already own their semantic <main>. */
const SELF_MAIN_PATHS = ['/account', '/collections', '/track-order', '/checkout', '/payment']

function isFooterlessPath(pathname: string): boolean {
  return FOOTERLESS_PATHS.some(
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

  useEffect(() => {
    if (ready) return
    const timer = window.setTimeout(() => {
      // Placeholder chrome also uses .auth-shell — only trust the real route tree.
      if (childrenRef.current?.querySelector('.auth-shell')) return
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
  const isChromeless = CHROMELESS_PATHS.includes(pathname)
  const hideFooter = isFooterlessPath(pathname)
  const selfMain = hasSelfMain(pathname)

  if (isChromeless) {
    return <>{children}</>
  }

  if (isAuth) {
    return <AuthRoutePaintGuard>{children}</AuthRoutePaintGuard>
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
      <Header />
      {selfMain ? (
        <div id="main-content" className="main-with-mobile-nav" tabIndex={-1}>
          {children}
        </div>
      ) : (
        <main
          id="main-content"
          className={hideFooter ? 'main-with-mobile-nav main-utility-page' : 'main-with-mobile-nav'}
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

/** Minimal fallback — never duplicate Header/Footer while Inner mounts. */
export function StorefrontChrome({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <StorefrontChromeInner>{children}</StorefrontChromeInner>
    </Suspense>
  )
}
