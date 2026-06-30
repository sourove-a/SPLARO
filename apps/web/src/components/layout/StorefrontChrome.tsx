'use client'

import { Suspense, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { SmoothScroll } from '@/components/layout/SmoothScroll'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
import { FloatingSystem } from '@/components/layout/FloatingSystem'

const AUTH_PATH_PREFIXES = ['/login', '/signup', '/forgot-password', '/reset-password']
const HEADER_ONLY_PATHS = ['/design/header']
const CHROMELESS_PATHS = ['/maintenance']

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
      <main id="main-content" className="main-with-mobile-nav" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      <Suspense fallback={null}>
        <MobileBottomNav />
      </Suspense>
      <FloatingSystem />
    </SmoothScroll>
  )
}

export function StorefrontChrome({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <>
          <Header />
          <main id="main-content" className="main-with-mobile-nav" tabIndex={-1}>{children}</main>
          <Footer />
          <Suspense fallback={null}>
            <MobileBottomNav />
          </Suspense>
          <FloatingSystem />
        </>
      }
    >
      <StorefrontChromeInner>{children}</StorefrontChromeInner>
    </Suspense>
  )
}
