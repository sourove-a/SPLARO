'use client'

import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { AdminErrorState } from '@/components/ui/AdminUiPrimitives'
import { apiOfflineMessage, apiOfflineHintShort } from '@/lib/admin/offline-copy'

export function ApiOfflineBanner({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="mb-3 space-y-2">
      <AdminErrorState
        title={apiOfflineHintShort()}
        message={message ?? apiOfflineMessage('this module')}
        {...(onRetry ? { onRetry } : {})}
      />
      <AdminNavLink
        href="/dashboard/api-health"
        className="inline-flex text-xs font-bold text-[var(--admin-text-secondary)] underline-offset-2 hover:underline"
      >
        Open API Health →
      </AdminNavLink>
    </div>
  )
}
