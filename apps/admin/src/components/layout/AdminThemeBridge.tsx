'use client'

import { useTheme } from 'next-themes'
import { useEffect } from 'react'
import { applyAdminTheme, isAdminThemeApplied, type DcTheme } from '@/components/dc/theme'

/**
 * Keeps next-themes (`html.dark`) and DC shell (`html[data-t]`) aligned.
 * Covers legacy AdminHeader toggles that only call next-themes setTheme.
 */
export function AdminThemeBridge() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    if (resolvedTheme !== 'light' && resolvedTheme !== 'dark') return
    const next = resolvedTheme as DcTheme
    if (!isAdminThemeApplied(next)) applyAdminTheme(next)
  }, [resolvedTheme])

  return null
}
