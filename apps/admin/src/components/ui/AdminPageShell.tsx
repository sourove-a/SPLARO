'use client'

import Link from 'next/link'
import { ChevronRight, Sparkles } from 'lucide-react'
import { toastWarn } from '@/lib/admin/feedback'
import { cn } from '@/lib/utils/cn'
import { markAdminLinkNavigation } from '@/lib/navigation/client-nav'
import { SplaroAdminLogo } from '@/components/brand/SplaroAdminLogo'
import { AdminButton } from '@/components/ui/AdminButton'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface KpiItem {
  label: string
  value: string | number
  change?: number
  trend?: 'up' | 'down' | 'neutral'
}

export interface QuickAction {
  label: string
  href?: string
  onClick?: () => void
  variant?: 'default' | 'gold'
}

interface AdminPageShellProps {
  title: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode
  kpis?: KpiItem[]
  quickActions?: QuickAction[]
  empty?: boolean
  emptyTitle?: string
  emptyDescription?: string
  children?: React.ReactNode
  className?: string
}

function BreadcrumbLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      prefetch
      onClick={() => markAdminLinkNavigation(href)}
      className="transition-colors hover:text-[#111111]"
    >
      {children}
    </Link>
  )
}

function QuickActionChip({ action }: { action: QuickAction }) {
  const chipClass = cn(
    'admin-glass-chip active:scale-[0.98]',
    action.variant === 'gold' && 'admin-glass-chip--gold',
  )

  const icon = action.variant === 'gold' ? <Sparkles className="h-3 w-3 text-[var(--admin-accent)]" /> : null

  if (action.href) {
    return (
      <Link
        href={action.href}
        scroll={false}
        prefetch
        onClick={() => markAdminLinkNavigation(action.href!)}
        className={chipClass}
      >
        {icon}
        {action.label}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={
        action.onClick ??
        (() => toastWarn(`${action.label} opens soon.`, 'action-pending'))
      }
      className={chipClass}
    >
      {icon}
      {action.label}
    </button>
  )
}

export function AdminPageShell({
  title,
  description,
  breadcrumbs,
  actions,
  kpis,
  quickActions,
  empty = false,
  emptyTitle,
  emptyDescription,
  children,
  className,
}: AdminPageShellProps) {
  return (
    <div className={cn('admin-module-canvas space-y-6', className)}>
      <div className="admin-page-header admin-glass-panel">
        <span className="admin-glass-panel__surface" aria-hidden="true" />
        <span className="admin-glass-panel__sheen" aria-hidden="true" />
        <div className="admin-page-header__inner admin-glass-panel__body flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            {breadcrumbs && breadcrumbs.length > 0 ? (
              <nav aria-label="Breadcrumb" className="admin-breadcrumb">
                {breadcrumbs.map((crumb, index) => (
                  <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                    {index > 0 ? <ChevronRight className="h-3 w-3 shrink-0 opacity-45" /> : null}
                    {crumb.href ? (
                      <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                    ) : (
                      <span className="admin-breadcrumb__current">{crumb.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            ) : null}

            <div>
              <h1 className="admin-page-title text-[1.35rem] sm:text-[1.45rem]">{title}</h1>
              {description ? (
                <p className="mt-1.5 max-w-2xl text-sm font-medium text-[var(--admin-text-secondary)] leading-relaxed">
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </div>

      {kpis && kpis.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="admin-kpi rounded-[20px]">
              <p className="admin-kpi__label">{kpi.label}</p>
              <p className="admin-kpi__value">{kpi.value}</p>
              {kpi.change !== undefined ? (
                <p
                  className={cn(
                    'mt-1 text-xs font-bold',
                    kpi.trend === 'up' && 'text-emerald-600',
                    kpi.trend === 'down' && 'text-red-500',
                    (!kpi.trend || kpi.trend === 'neutral') && 'text-[#6B6B6B]',
                  )}
                >
                  {kpi.change > 0 ? '+' : ''}
                  {kpi.change}%
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {quickActions && quickActions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <QuickActionChip key={action.label} action={action} />
          ))}
        </div>
      ) : null}

      <div className="admin-module-body">
        {empty ? (
          <div className="admin-empty-state">
            <SplaroAdminLogo variant="empty" className="mx-auto mb-4 opacity-80" />
            <h2 className="text-base font-black text-[var(--admin-text)]">{emptyTitle ?? 'No data yet'}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm font-semibold text-[var(--admin-text-secondary)]">
              {emptyDescription ?? 'This module is ready. Data will appear here once configured.'}
            </p>
            <AdminButton
              variant="gold"
              className="mt-5"
              onClick={() =>
                toastWarn('Notifications are not wired yet — check back after module goes live.', 'notify-pending')
              }
            >
              Notify me
            </AdminButton>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
