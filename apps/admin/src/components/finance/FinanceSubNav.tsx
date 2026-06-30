'use client'

import {
  Banknote,
  CalendarCheck,
  CheckCircle2,
  FileBarChart,
  Loader2,
  PiggyBank,
  Receipt,
  Sheet,
  TrendingUp,
  Users,
} from 'lucide-react'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { cn } from '@/lib/utils/cn'

type RouteStatus = 'ok' | 'warn' | 'down' | 'loading'

export const FINANCE_ROUTES = [
  { href: '/dashboard/finance/finance-reports', label: 'Finance Overview', icon: FileBarChart },
  { href: '/dashboard/finance/partner-accounts', label: 'Partner Hub', icon: Users },
  { href: '/dashboard/finance/expenses', label: 'Expenses', icon: Receipt },
  { href: '/dashboard/finance/investments', label: 'Investments', icon: PiggyBank },
  { href: '/dashboard/finance/withdrawals', label: 'Withdrawals', icon: Banknote },
  { href: '/dashboard/finance/profit-loss', label: 'Profit & Loss', icon: TrendingUp },
  { href: '/dashboard/finance/daily-closing', label: 'Daily Closing', icon: CalendarCheck },
  { href: '/dashboard/finance/google-sheets-finance', label: 'Google Sheets', icon: Sheet },
] as const

export function FinanceSubNav({
  activeHref,
  statusByHref,
}: {
  activeHref: string
  statusByHref?: Partial<Record<string, RouteStatus>>
}) {
  return (
    <nav className="ops-subnav" aria-label="Finance modules">
      {FINANCE_ROUTES.map(({ href, label, icon: Icon }) => {
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
