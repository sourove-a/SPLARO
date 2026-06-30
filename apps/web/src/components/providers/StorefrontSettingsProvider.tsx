'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { FALLBACK_SETTINGS, type StorefrontSettings } from '@/lib/storefront/settings'

const StorefrontSettingsContext = createContext<StorefrontSettings>(FALLBACK_SETTINGS)

export function StorefrontSettingsProvider({
  settings,
  children,
}: {
  settings: StorefrontSettings
  children: ReactNode
}) {
  return (
    <StorefrontSettingsContext.Provider value={settings}>{children}</StorefrontSettingsContext.Provider>
  )
}

export function useStorefrontSettings() {
  return useContext(StorefrontSettingsContext)
}
