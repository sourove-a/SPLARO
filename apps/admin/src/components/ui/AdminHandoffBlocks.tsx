'use client'

import type { ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { AdminButton } from '@/components/ui/AdminButton'

export function VisibilityBadge({ visible }: { visible: boolean }) {
  return (
    <span
      className={cn('admin-vis-badge', visible ? 'admin-vis-badge--visible' : 'admin-vis-badge--hidden')}
    >
      {visible ? <Eye className="h-3 w-3" aria-hidden /> : <EyeOff className="h-3 w-3" aria-hidden />}
      {visible ? 'Visible' : 'Hidden'}
    </span>
  )
}

interface VisibilityRowProps {
  title: string
  hint?: string
  visible: boolean
  saving?: boolean
  onToggle: () => void
  className?: string
  hideLabel?: string
  showLabel?: string
}

/** Eye + badge + labelled Hide/Show — never icon-only (handoff vis/pub). */
export function VisibilityRow({
  title,
  hint,
  visible,
  saving,
  onToggle,
  className,
  hideLabel = 'Hide from site',
  showLabel = 'Show on site',
}: VisibilityRowProps) {
  return (
    <div className={cn('admin-vis-row', className)}>
      <div className="admin-vis-row__meta">
        <span className="admin-vis-row__title">{title}</span>
        {hint ? <span className="admin-vis-row__hint">{hint}</span> : null}
      </div>
      <div className="admin-vis-row__controls">
        <VisibilityBadge visible={visible} />
        <AdminButton
          size="sm"
          variant={visible ? 'ghost' : 'accent'}
          {...(saving !== undefined ? { loading: saving } : {})}
          onClick={onToggle}
        >
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {visible ? hideLabel : showLabel}
        </AdminButton>
      </div>
    </div>
  )
}

export type KpiTone = 'default' | 'success' | 'warning' | 'danger'

export interface KpiItem {
  label: string
  value: string | number
  sub?: string
  /** Colours the value only. Never use it to introduce violet — rule 1. */
  tone?: KpiTone
}

export function KpiGrid({ items, columns = 2 }: { items: KpiItem[]; columns?: 2 | 4 }) {
  return (
    <div className={cn('admin-kpi-grid', columns === 4 && 'admin-kpi-grid--4')}>
      {items.map((item) => (
        <div key={item.label} className="admin-kpi-tile">
          <p className="admin-kpi-tile__label">{item.label}</p>
          <p
            className={cn(
              'admin-kpi-tile__value',
              item.tone && item.tone !== 'default' && `admin-kpi-tile__value--${item.tone}`,
            )}
          >
            {item.value}
          </p>
          {item.sub ? <p className="admin-kpi-tile__sub">{item.sub}</p> : null}
        </div>
      ))}
    </div>
  )
}

export function DecisionCard({
  title,
  sku,
  badge,
  decision,
  deadline,
  why,
  stats,
  actions,
  tone = 'warn',
}: {
  title: string
  /** Record the decision is about — SKU, invoice, parcel id. */
  sku?: string
  /** Short severity line, e.g. "Out of stock · still live". */
  badge?: string
  decision: string
  /** When it has to happen by, shown next to the decision. */
  deadline?: string
  why?: string
  stats?: Array<{ label: string; value: string | number }>
  actions?: ReactNode
  tone?: 'warn' | 'bad' | 'ok' | 'info'
}) {
  return (
    <article className="admin-decide-card">
      <div className={cn('admin-decide-card__stripe', `admin-decide-card__stripe--${tone}`)} />
      <div className="admin-decide-card__body">
        <div className="admin-decide-card__head">
          <h3 className="admin-decide-card__title">{title}</h3>
          {sku ? <span className="admin-decide-card__sku">{sku}</span> : null}
        </div>
        {badge ? (
          <span className={cn('admin-decide-card__badge', `admin-decide-card__badge--${tone}`)}>
            {badge}
          </span>
        ) : null}
        <p className="admin-decide-card__line">
          {decision}
          {deadline ? <span className="admin-decide-card__deadline">{deadline}</span> : null}
        </p>
        {why ? <p className="admin-decide-card__why">{why}</p> : null}
        {stats && stats.length > 0 ? (
          <div className="admin-decide-card__stats">
            {stats.map((s) => (
              <div key={s.label} className="admin-decide-card__stat">
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        ) : null}
        {actions ? <div className="admin-decide-card__actions">{actions}</div> : null}
      </div>
    </article>
  )
}

export function DirtySaveBar({
  message = 'Unsaved text changes',
  actions,
}: {
  message?: string
  actions?: ReactNode
}) {
  return (
    <div className="admin-dirty-bar" role="status">
      <span>{message}</span>
      {actions}
    </div>
  )
}

export function BetaBanner({ route, children }: { route?: string; children?: ReactNode }) {
  return (
    <div className="admin-beta-banner" role="note">
      <span className="admin-beta-banner__chip">BETA</span>
      <span>Not in primary nav</span>
      {route ? <code>{route}</code> : null}
      {children}
    </div>
  )
}
