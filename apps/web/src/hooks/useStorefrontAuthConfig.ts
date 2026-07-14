'use client'

import { useEffect, useState } from 'react'
import { fetchStorefrontAuthConfig } from '@/lib/storefront/phone-otp'

export interface StorefrontAuthConfig {
  phoneOtpEnabled: boolean
  googleSignInEnabled: boolean
  loaded: boolean
}

export function useStorefrontAuthConfig(): StorefrontAuthConfig {
  const [config, setConfig] = useState<StorefrontAuthConfig>({
    phoneOtpEnabled: false,
    googleSignInEnabled: false,
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
