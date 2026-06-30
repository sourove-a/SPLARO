'use client'

import { WifiOff } from 'lucide-react'
import { AdminNavLink } from '@/components/layout/AdminNavLink'

export function ApiOfflineBanner({ message }: { message?: string }) {
  return (
    <div className="admin-offline-banner">
      <p className="flex items-center gap-2 text-sm font-black text-amber-900">
        <WifiOff className="h-4 w-4 shrink-0" />
        {message ?? 'API offline — run pnpm dev:stack (or pnpm dev:api)'}
      </p>
      <AdminNavLink href="/dashboard/api-health" className="mt-2 inline-flex text-xs font-black text-amber-900 underline">
        Open API Health →
      </AdminNavLink>
    </div>
  )
}

export function KpiGrid({ items }: { items: [string, string | number, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(([label, value, tone]) => (
        <div key={label} className="admin-kpi rounded-[20px]">
          <p className="admin-kpi__label">{label}</p>
          <p className={`admin-kpi__value${tone !== 'default' ? ` admin-kpi__value--${tone}` : ''}`}>{value}</p>
        </div>
      ))}
    </div>
  )
}
