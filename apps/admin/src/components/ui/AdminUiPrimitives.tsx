'use client'

import { type ElementType, type ReactNode } from 'react'
import { AlertCircle, Inbox, PlugZap, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { AdminButton } from '@/components/ui/AdminButton'

export function AdminSkeleton({ className }: { className?: string }) {
  return <div className={cn('admin-skeleton', className)} aria-hidden="true" />
}

export function AdminSkeletonGroup({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <AdminSkeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  )
}

/** Table-shaped skeleton — fixed row heights to avoid layout shift. */
export function AdminTableSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('admin-table-skeleton', className)} aria-busy="true" aria-label="Loading table">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="admin-table-skeleton__row" />
      ))}
    </div>
  )
}

export function AdminStatSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('admin-kpi space-y-2', className)} aria-busy="true" aria-label="Loading">
      <AdminSkeleton className="h-2.5 w-16" />
      <AdminSkeleton className="h-7 w-24" />
      <AdminSkeleton className="h-2.5 w-20" />
    </div>
  )
}

interface AdminEmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  icon?: ElementType
  className?: string
}

export function AdminEmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  className,
}: AdminEmptyStateProps) {
  return (
    <div className={cn('admin-empty-state admin-empty-state--panel', className)}>
      <div className="admin-empty-state__icon">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <h2 className="admin-empty-state__title">{title}</h2>
      {description ? <p className="admin-empty-state__text">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

interface AdminErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}

export function AdminErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: AdminErrorStateProps) {
  return (
    <div className={cn('admin-error-state', className)} role="alert">
      <AlertCircle className="admin-error-state__icon" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="admin-error-state__title">{title}</p>
        {message ? <p className="admin-error-state__text">{message}</p> : null}
      </div>
      {onRetry ? (
        <AdminButton size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </AdminButton>
      ) : null}
    </div>
  )
}

interface AdminBackendMissingAlertProps {
  headline: string
  body: string
  className?: string
}

export function AdminBackendMissingAlert({ headline, body, className }: AdminBackendMissingAlertProps) {
  return (
    <div className={cn('admin-alert admin-alert--missing', className)} role="alert">
      <PlugZap className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="admin-alert__title">{headline}</p>
        <p className="admin-alert__body">{body}</p>
      </div>
    </div>
  )
}

interface AdminWarningAlertProps {
  headline: string
  body: string
  className?: string
}

export function AdminWarningAlert({ headline, body, className }: AdminWarningAlertProps) {
  return (
    <div className={cn('admin-alert admin-alert--warning', className)} role="status">
      <div className="min-w-0">
        <p className="admin-alert__title">{headline}</p>
        <p className="admin-alert__body">{body}</p>
      </div>
    </div>
  )
}
