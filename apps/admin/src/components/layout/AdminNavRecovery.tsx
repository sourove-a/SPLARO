'use client'

import { useEffect } from 'react'
import { installAdminNavRecovery } from '@/lib/navigation/client-nav'

/** Installs global fallback when App Router soft navigation fails in dev. */
export function AdminNavRecovery() {
  useEffect(() => {
    installAdminNavRecovery()
  }, [])

  return null
}
