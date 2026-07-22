'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { captureAttributionFromLocation } from '@/lib/analytics/attribution'

function AttributionCaptureInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()

  useEffect(() => {
    captureAttributionFromLocation()
  }, [pathname, search])

  return null
}

export function AttributionCapture() {
  return (
    <Suspense fallback={null}>
      <AttributionCaptureInner />
    </Suspense>
  )
}
