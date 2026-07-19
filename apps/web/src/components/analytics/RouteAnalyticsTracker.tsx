'use client'

import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { trackAnalyticsPageView } from '@/lib/analytics/runtime'

function RouteAnalyticsTrackerInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const lastTrackedUrl = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname) return
    const pagePath = search ? `${pathname}?${search}` : pathname
    if (lastTrackedUrl.current === pagePath) return

    lastTrackedUrl.current = pagePath
    trackAnalyticsPageView({
      pagePath,
      pageLocation: `${window.location.origin}${pagePath}`,
      pageTitle: document.title,
    })
  }, [pathname, search])

  return null
}

export function RouteAnalyticsTracker() {
  return (
    <Suspense fallback={null}>
      <RouteAnalyticsTrackerInner />
    </Suspense>
  )
}
