import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

type AdminGlassProps = {
  children: ReactNode
  className?: string
  as?: 'div' | 'header' | 'aside'
  elevated?: boolean
}

export function AdminGlass({
  children,
  className,
  as: Tag = 'div',
  elevated = false,
}: AdminGlassProps) {
  return (
    <Tag
      className={cn(
        'admin-glass-panel',
        elevated && 'admin-glass-panel--elevated',
        className,
      )}
    >
      <span className="admin-glass-panel__surface" aria-hidden="true" />
      <span className="admin-glass-panel__sheen" aria-hidden="true" />
      <div className="admin-glass-panel__body">{children}</div>
    </Tag>
  )
}
