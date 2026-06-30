'use client'

import { useEffect } from 'react'
import { captureAttributionFromLocation } from '@/lib/analytics/attribution'

export function AttributionCapture() {
  useEffect(() => {
    captureAttributionFromLocation()
  }, [])

  return null
}
