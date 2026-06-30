'use client'

import { CheckCircle2, Loader2, Lock, ScrollText, Shield, ShieldCheck, UserCog } from 'lucide-react'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { cn } from '@/lib/utils/cn'

type RouteStatus = 'ok' | 'warn' | 'down' | 'loading'

export const SECURITY_ROUTES = [
  { href: '/dashboard/security-center', label: 'Security Center', icon: Shield },
  { href: '/dashboard/admin-users', label: 'Admin Users', icon: UserCog },
  { href: '/dashboard/roles', label: 'Roles', icon: ShieldCheck },
  { href: '/dashboard/permissions', label: 'Permissions', icon: Lock },
  { href: '/dashboard/audit-logs', label: 'Audit Logs', icon: ScrollText },
] as const

export function SecuritySubNav({
  activeHref,
  statusByHref,
}: {
  activeHref: string
  statusByHref?: Partial<Record<string, RouteStatus>>
}) {
  return (
    <nav className="ops-subnav" aria-label="Security modules">
      {SECURITY_ROUTES.map(({ href, label, icon: Icon }) => {
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
