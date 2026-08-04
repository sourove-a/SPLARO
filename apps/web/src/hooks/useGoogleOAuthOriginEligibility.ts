'use client'

import { useEffect, useState } from 'react'
import { isGoogleOAuthOriginEligible } from '@/lib/auth/google-oauth-origin'

export { isGoogleOAuthOriginEligible } from '@/lib/auth/google-oauth-origin'

/** Prevent GIS initialization (and its console error) on an unregistered local origin. */
export function useGoogleOAuthOriginEligibility(): boolean | null {
  const [eligible, setEligible] = useState<boolean | null>(null)

  useEffect(() => {
    setEligible(isGoogleOAuthOriginEligible(window.location.hostname))
  }, [])

  return eligible
}
