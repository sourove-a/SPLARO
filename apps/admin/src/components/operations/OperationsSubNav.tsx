'use client'

import { CheckCircle2, Loader2, Truck, Warehouse, Users, Zap } from 'lucide-react'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { cn } from '@/lib/utils/cn'

export const OPERATIONS_ROUTES = [
  { href: '/dashboard/operations', label: 'Overview', icon: Truck },
  { href: '/dashboard/shipping', label: 'Shipping', icon: Truck },
  { href: '/dashboard/courier-hub', label: 'Courier Hub', icon: Truck },
  { href: '/dashboard/automation-rules', label: 'Automation', icon: Zap },
  { href: '/dashboard/wms/overview', label: 'WMS', icon: Warehouse },
  { href: '/dashboard/procurement/overview', label: 'Procurement', icon: Users },
] as const

type OpsRouteStatus = 'ok' | 'warn' | 'down' | 'loading'

export function OperationsSubNav({
  activeHref,
  statusByHref,
}: {
  activeHref: string
  statusByHref?: Partial<Record<string, OpsRouteStatus>>
}) {
  return (
    <nav className="ops-subnav" aria-label="Operations modules">
      {OPERATIONS_ROUTES.map(({ href, label, icon: Icon }) => {
        const active = activeHref === href
        const status = statusByHref?.[href] ?? 'ok'
        return (
          <AdminNavLink
            key={href}
            href={href}
            className={cn('ops-subnav__link', active && 'ops-subnav__link--active')}
          >
            <Icon className="ops-subnav__icon" strokeWidth={2} />
            <span>{label}</span>
            {status === 'loading' ? (
              <Loader2 className="ops-subnav__status ops-subnav__status--loading" />
            ) : status === 'down' ? (
              <span className="ops-subnav__status ops-subnav__status--down" />
            ) : status === 'warn' ? (
              <span className="ops-subnav__status ops-subnav__status--warn" />
            ) : (
              <CheckCircle2 className="ops-subnav__status ops-subnav__status--ok" />
            )}
          </AdminNavLink>
        )
      })}
    </nav>
  )
}
