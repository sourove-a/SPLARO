'use client'

import { useEffect, useState } from 'react'

const LOCAL_GOOGLE_OAUTH_ENABLED =
  process.env.NEXT_PUBLIC_GOOGLE_OAUTH_LOCAL_ENABLED === 'true'

export function isGoogleOAuthOriginEligible(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase()
  const isLoopback =
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '[::1]' ||
    normalized === '::1'

  return !isLoopback || LOCAL_GOOGLE_OAUTH_ENABLED
}

/** Prevent GIS initialization (and its console error) on an unregistered local origin. */
export function useGoogleOAuthOriginEligibility(): boolean | null {
  const [eligible, setEligible] = useState<boolean | null>(null)

  useEffect(() => {
    setEligible(isGoogleOAuthOriginEligible(window.location.hostname))
  }, [])

  return eligible
}
