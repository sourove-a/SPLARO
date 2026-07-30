'use client'

import Link from 'next/link'
import { ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { markAdminLinkNavigation } from '@/lib/navigation/client-nav'
import { AdminLinkButton } from '@/components/ui/AdminButton'
import { AdminEmptyState } from '@/components/ui/AdminUiPrimitives'

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
  variant?: 'default' | 'accent' | 'gold' /* gold deprecated → accent */
  /** When true, chip is non-interactive with backend-missing styling. */
  disabled?: boolean
  disabledReason?: string
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
  /** Modules with their own command hero (e.g. Settings) skip the outer page header. */
  hideHeader?: boolean
}

function BreadcrumbLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      prefetch
      onClick={() => markAdminLinkNavigation(href)}
      className="transition-colors hover:text-[var(--admin-accent)]"
    >
      {children}
    </Link>
  )
}

function QuickActionChip({ action }: { action: QuickAction }) {
  const isAccent = action.variant === 'gold' || action.variant === 'accent'
  const chipClass = cn(
    'admin-glass-chip active:scale-[0.98]',
    isAccent && 'admin-glass-chip--accent admin-glass-chip--gold',
    (action.disabled || (!action.href && !action.onClick)) &&
      'pointer-events-none cursor-not-allowed opacity-55',
  )

  const icon = isAccent ? <Sparkles className="h-3 w-3 text-[var(--admin-accent)]" /> : null
  const disabledReason =
    action.disabledReason ?? 'Action not connected to backend'

  if (action.disabled || (!action.href && !action.onClick)) {
    return (
      <span
        className={cn(chipClass, 'admin-glass-chip--disabled flex flex-col items-start gap-0.5 py-2')}
        title={disabledReason}
        aria-disabled="true"
      >
        <span className="inline-flex items-center gap-1.5">
          {icon}
          {action.label}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          Not connected to backend
        </span>
      </span>
    )
  }

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
    <button type="button" onClick={action.onClick} className={chipClass}>
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
  hideHeader = false,
}: AdminPageShellProps) {
  return (
    <div className={cn('admin-module-canvas admin-panel-page space-y-6', className, hideHeader && 'space-y-0')}>
      {hideHeader ? null : (
      <div className="admin-page-header admin-catalog-hero admin-panel-hero !mb-0">
        <div className="admin-page-header__inner flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
              <h1 className="admin-catalog-hero__title">{title}</h1>
              {description ? (
                <p className="admin-page-header__description mt-1.5 max-w-2xl">
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          {actions ? (
            <div className="admin-page-header__actions flex min-w-0 flex-[0_1_auto] flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
      )}

      {kpis && kpis.length > 0 ? (
        <div className="admin-kpi-grid admin-kpi-grid--catalog">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="admin-kpi-card">
              <p className="admin-kpi-card__label">{kpi.label}</p>
              <div className="admin-kpi-card__row">
                <p className="admin-kpi-card__value">{kpi.value}</p>
                {kpi.change !== undefined ? (
                  <span
                    className={cn(
                      'admin-kpi-card__delta',
                      kpi.trend === 'up' && 'admin-kpi-card__delta--up',
                      kpi.trend === 'down' && 'admin-kpi-card__delta--down',
                      (!kpi.trend || kpi.trend === 'neutral') && 'admin-kpi-card__delta--neutral',
                    )}
                  >
                    {kpi.change > 0 ? '+' : ''}
                    {kpi.change}%
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {quickActions && quickActions.length > 0 ? (
        <div className="admin-page-quick-actions">
          {quickActions.map((action) => (
            <QuickActionChip key={action.label} action={action} />
          ))}
        </div>
      ) : null}

      <div className="admin-module-body admin-page-enter">
        {empty ? (
          <AdminEmptyState
            title={emptyTitle ?? 'No data yet'}
            description={emptyDescription ?? 'This module is ready. Data will appear here once configured.'}
            action={
              <AdminLinkButton href="/dashboard" variant="ghost">
                Back to dashboard
              </AdminLinkButton>
            }
          />
        ) : (
          children
        )}
      </div>
    </div>
  )
}
