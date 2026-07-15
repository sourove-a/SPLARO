'use client'

import { Suspense, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { SmoothScroll } from '@/components/layout/SmoothScroll'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'

const FloatingSystem = dynamic(
  () => import('@/components/layout/FloatingSystem').then((m) => m.FloatingSystem),
  { ssr: false },
)

const AUTH_PATH_PREFIXES = ['/login', '/signup', '/forgot-password', '/reset-password']
const HEADER_ONLY_PATHS = ['/design/header']
const CHROMELESS_PATHS = ['/maintenance']
/** Focused flows — earth footer intrudes on short utility pages (cart, checkout). */
const FOOTERLESS_PATHS = ['/cart', '/checkout']

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

function StorefrontChromeInner({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isAuth = isAuthPath(pathname)
  const isHeaderOnly = isHeaderOnlyPath(pathname)
  const isChromeless = CHROMELESS_PATHS.includes(pathname)
  const hideFooter = isFooterlessPath(pathname)

  if (isChromeless) {
    return <>{children}</>
  }

  if (isAuth) {
    return <>{children}</>
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
      <main
        id="main-content"
        className={hideFooter ? 'main-with-mobile-nav main-utility-page' : 'main-with-mobile-nav'}
        tabIndex={-1}
      >
        {children}
      </main>
      {hideFooter ? null : <Footer />}
      <Suspense fallback={null}>
        <MobileBottomNav />
      </Suspense>
      <FloatingSystem />
    </SmoothScroll>
  )
}

/** Static chrome only — never mount a second Lenis in Suspense fallback. */
function StorefrontChromeFallback({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main id="main-content" className="main-with-mobile-nav" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </>
  )
}

export function StorefrontChrome({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<StorefrontChromeFallback>{children}</StorefrontChromeFallback>}>
      <StorefrontChromeInner>{children}</StorefrontChromeInner>
    </Suspense>
  )
}
