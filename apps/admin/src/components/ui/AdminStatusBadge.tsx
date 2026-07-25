import { cn } from '@/lib/utils/cn'

export type AdminBadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'muted'

const toneClass: Record<AdminBadgeTone, string> = {
  success: 'admin-badge admin-badge--success admin-badge--dot',
  warning: 'admin-badge admin-badge--warning admin-badge--dot',
  danger: 'admin-badge admin-badge--danger admin-badge--dot',
  info: 'admin-badge admin-badge--info admin-badge--dot',
  muted: 'admin-badge admin-badge--muted admin-badge--dot',
}

interface AdminStatusBadgeProps {
  label: string
  tone?: AdminBadgeTone
  title?: string
  className?: string
  /** Hide the leading status dot (CSS ::before) */
  plain?: boolean
}

/** Unified status / live / health pill — consistent height, padding, readable contrast. */
export function AdminStatusBadge({
  label,
  tone = 'muted',
  title,
  className,
  plain = false,
}: AdminStatusBadgeProps) {
  return (
    <span
      className={cn(toneClass[tone], plain && 'admin-badge--plain', className)}
      title={title ?? label}
    >
      <span className="min-w-0 truncate">{label}</span>
    </span>
  )
}
