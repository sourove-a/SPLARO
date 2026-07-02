'use client'

import { ModuleReadinessBar } from '@/components/ui/connection/ModuleReadinessBar'

interface ProductFormStatusBarProps {
  categoriesLoading: boolean
  categoriesCount: number
  collectionsCount: number
  variantCount: number
  canSubmit: boolean
}

/** Form readiness only — no API/DB ping (global status lives in AdminApiStatus). */
export function ProductFormStatusBar({
  categoriesLoading,
  categoriesCount,
  collectionsCount,
  variantCount,
  canSubmit,
}: ProductFormStatusBarProps) {
  return (
    <ModuleReadinessBar
      items={[
        {
          key: 'cats',
          label: categoriesLoading ? 'Categories…' : `${categoriesCount} categories`,
          ok: !categoriesLoading && categoriesCount > 0,
          loading: categoriesLoading,
        },
        {
          key: 'cols',
          label: `${collectionsCount} collections`,
          ok: collectionsCount >= 0,
        },
        {
          key: 'variants',
          label: `${variantCount} variant${variantCount === 1 ? '' : 's'}`,
          ok: variantCount > 0,
        },
        {
          key: 'ready',
          label: canSubmit ? 'Ready to create' : 'Complete required fields',
          ok: canSubmit,
          highlight: true,
        },
      ]}
    />
  )
}
