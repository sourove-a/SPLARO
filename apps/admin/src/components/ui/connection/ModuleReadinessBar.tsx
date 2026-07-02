'use client'

import { ConnectionChip, type ConnectionChipState } from '@/components/ui/connection/ConnectionChip'

export interface ReadinessItem {
  key: string
  label: string
  ok: boolean
  loading?: boolean
  highlight?: boolean
}

export function ModuleReadinessBar({ items }: { items: ReadinessItem[] }) {
  return (
    <div className="admin-conn-strip admin-conn-strip--readiness" role="status" aria-live="polite">
      <div className="admin-conn-strip__chips">
        {items.map((item) => {
          let state: ConnectionChipState = item.ok ? 'ok' : 'muted'
          if (item.loading) state = 'loading'
          if (item.highlight && item.ok) state = 'ready'
          if (!item.ok && !item.loading) state = 'warn'

          return (
            <ConnectionChip
              key={item.key}
              label={item.label}
              state={state}
              compact
            />
          )
        })}
      </div>
    </div>
  )
}
