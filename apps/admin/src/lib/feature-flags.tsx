'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  FEATURE_FLAG_DEFAULTS,
  type FeatureFlags,
} from '@splaro/config'
import { apiFetch } from '@/lib/api/client'
import { setAdminFeatureFlags } from '@/lib/navigation/admin-nav'

const FeatureFlagsContext = createContext<FeatureFlags>(FEATURE_FLAG_DEFAULTS)

export function useFeatureFlags(): FeatureFlags {
  return useContext(FeatureFlagsContext)
}

export function useFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return useFeatureFlags()[flag]
}

/** Fetches GET /api/v1/features and syncs admin nav gates. */
export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(FEATURE_FLAG_DEFAULTS)

  useEffect(() => {
    let cancelled = false
    void apiFetch<FeatureFlags>('/features')
      .then((data) => {
        if (cancelled || !data || typeof data !== 'object') return
        const next: FeatureFlags = {
          ai: Boolean(data.ai ?? FEATURE_FLAG_DEFAULTS.ai),
          saas: Boolean(data.saas ?? FEATURE_FLAG_DEFAULTS.saas),
          vendor: Boolean(data.vendor ?? FEATURE_FLAG_DEFAULTS.vendor),
          loyalty: Boolean(data.loyalty ?? FEATURE_FLAG_DEFAULTS.loyalty),
          chatbot: Boolean(data.chatbot ?? FEATURE_FLAG_DEFAULTS.chatbot),
          googleSheets: Boolean(data.googleSheets ?? FEATURE_FLAG_DEFAULTS.googleSheets),
          printAuto: Boolean(data.printAuto ?? FEATURE_FLAG_DEFAULTS.printAuto),
        }
        setAdminFeatureFlags(next)
        setFlags(next)
      })
      .catch(() => {
        /* keep safe defaults — SaaS/vendor/loyalty stay off */
        setAdminFeatureFlags(FEATURE_FLAG_DEFAULTS)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(() => flags, [flags])

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>
}
