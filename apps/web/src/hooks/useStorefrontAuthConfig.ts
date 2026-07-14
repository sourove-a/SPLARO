'use client'

import { useEffect, useState } from 'react'
import { fetchStorefrontAuthConfig } from '@/lib/storefront/phone-otp'

export interface StorefrontAuthConfig {
  phoneOtpEnabled: boolean
  googleSignInEnabled: boolean
  googleClientId: string
  loaded: boolean
}

const BAKED_GOOGLE =
  process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() ||
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
  ''

export function useStorefrontAuthConfig(): StorefrontAuthConfig {
  const [config, setConfig] = useState<StorefrontAuthConfig>({
    phoneOtpEnabled: false,
    // Optimistic: if baked into the bundle, show Google before config returns.
    googleSignInEnabled: Boolean(BAKED_GOOGLE),
    googleClientId: BAKED_GOOGLE,
    loaded: false,
  })

  useEffect(() => {
    let cancelled = false
    void fetchStorefrontAuthConfig().then((result) => {
      if (cancelled) return
      setConfig({ ...result, loaded: true })
    })
    return () => {
      cancelled = true
    }
  }, [])

  return config
}
