'use client'

import { useEffect } from 'react'
import { AdminButton } from '@/components/ui/AdminButton'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[SPLARO Admin]', error)
  }, [error])

  return (
    <div className="admin-module-card mx-auto max-w-lg text-center">
      <h2 className="text-lg font-black text-[#111111]">Something went wrong</h2>
      <p className="mt-2 text-sm font-semibold text-[#6B6B6B]">
        {error.message?.includes('Failed to fetch')
          ? 'Navigation was interrupted — usually a dev compile hiccup. Reload or try again.'
          : error.message || 'An unexpected error occurred in this module.'}
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <AdminButton variant="gold" onClick={reset}>
          Try again
        </AdminButton>
        <AdminButton onClick={() => window.location.assign('/dashboard')}>Back to dashboard</AdminButton>
        {error.message?.includes('Failed to fetch') ? (
          <AdminButton onClick={() => window.location.reload()}>Reload page</AdminButton>
        ) : null}
      </div>
    </div>
  )
}
