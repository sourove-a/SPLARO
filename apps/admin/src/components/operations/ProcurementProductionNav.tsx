'use client'

import { Building2, CheckCircle2, FileText, LayoutGrid, Loader2, PackageCheck, Scissors, Layers } from 'lucide-react'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { cn } from '@/lib/utils/cn'

type RouteStatus = 'ok' | 'warn' | 'down' | 'loading'

export const PROCUREMENT_ROUTES = [
  { href: '/dashboard/procurement/overview', label: 'Overview', icon: LayoutGrid },
  { href: '/dashboard/procurement/suppliers', label: 'Suppliers', icon: Building2 },
  { href: '/dashboard/procurement/purchase-orders', label: 'Purchase Orders', icon: FileText },
  { href: '/dashboard/procurement/goods-received', label: 'Goods Received', icon: PackageCheck },
] as const

export function ProcurementSubNav({
  activeHref,
  statusByHref,
}: {
  activeHref: string
  statusByHref?: Partial<Record<string, RouteStatus>>
}) {
  return (
    <nav className="ops-subnav" aria-label="Procurement modules">
      {PROCUREMENT_ROUTES.map(({ href, label, icon: Icon }) => {
        const active = activeHref === href
        const status = statusByHref?.[href] ?? 'ok'
        return (
          <AdminNavLink key={href} href={href} className={cn('ops-subnav__link', active && 'ops-subnav__link--active')}>
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

export const PRODUCTION_ROUTES = [
  { href: '/dashboard/production/overview', label: 'Overview', icon: Scissors },
  { href: '/dashboard/production/fabric-inventory', label: 'Fabric Inventory', icon: Layers },
] as const

export function ProductionSubNav({
  activeHref,
  statusByHref,
}: {
  activeHref: string
  statusByHref?: Partial<Record<string, RouteStatus>>
}) {
  return (
    <nav className="ops-subnav" aria-label="Production modules">
      {PRODUCTION_ROUTES.map(({ href, label, icon: Icon }) => {
        const active = activeHref === href
        const status = statusByHref?.[href] ?? 'ok'
        return (
          <AdminNavLink key={href} href={href} className={cn('ops-subnav__link', active && 'ops-subnav__link--active')}>
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
