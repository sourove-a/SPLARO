'use client'

import { useLayoutEffect } from 'react'
import { useAdminPreferencesStore } from '@/store/preferencesStore'
import { useAdminUiStore } from '@/store/uiStore'

export function AdminPersistHydrator() {
  useLayoutEffect(() => {
    void Promise.all([
      useAdminPreferencesStore.persist.rehydrate(),
      useAdminUiStore.persist.rehydrate(),
    ])
  }, [])

  return null
}
