'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, type ReactNode } from 'react'

interface DashboardMainProps {
  children: ReactNode
}

/**
 * Main scrollport for the dashboard shell.
 * Intentionally no page-level AnimatePresence / keyed remount —
 * mode="wait" + key={pathname} blocked clicks and felt like hang/jump.
 */
export function DashboardMain({ children }: DashboardMainProps) {
  const pathname = usePathname()
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    document.documentElement.classList.add('admin-dashboard-active')
    document.body.classList.add('admin-dashboard-active')
    return () => {
      document.documentElement.classList.remove('admin-dashboard-active')
      document.body.classList.remove('admin-dashboard-active')
    }
  }, [])

  // Instant snap — smooth scrollTo on every nav felt like a jump/lag
  useEffect(() => {
    const main = mainRef.current
    if (!main) return
    main.scrollTop = 0
  }, [pathname])

  return (
    <main
      ref={mainRef}
      data-admin-main-scroll
      className="admin-main w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-24 pt-4 lg:px-5 lg:pr-4"
    >
      <div className="admin-dashboard-canvas min-h-full">{children}</div>
    </main>
  )
}
