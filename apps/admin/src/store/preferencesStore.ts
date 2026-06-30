'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DashboardPeriod } from '@/types'

interface AdminPreferencesStore {
  dashboardPeriodLabel: string
  storeSlug: string
  setDashboardPeriodLabel: (label: string) => void
  setStoreSlug: (slug: string) => void
}

export const useAdminPreferencesStore = create<AdminPreferencesStore>()(
  persist(
    (set) => ({
      dashboardPeriodLabel: '7 Days',
      storeSlug: 'splaro',
      setDashboardPeriodLabel: (label) => set({ dashboardPeriodLabel: label }),
      setStoreSlug: (slug) => set({ storeSlug: slug }),
    }),
    {
      name: 'splaro-admin-preferences',
      skipHydration: true,
    },
  ),
)

export function periodLabelToApi(periodLabel: string): DashboardPeriod {
  if (periodLabel === 'Today') return '1d'
  if (periodLabel === '7 Days') return '7d'
  if (periodLabel === '30 Days') return '30d'
  return '90d'
}
