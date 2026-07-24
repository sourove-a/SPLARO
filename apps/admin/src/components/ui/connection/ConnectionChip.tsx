'use client'

import Link from 'next/link'
import { CheckCircle2, Loader2, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type ConnectionChipState = 'ok' | 'warn' | 'off' | 'muted' | 'ready' | 'loading'

export interface ConnectionChipProps {
  label: string
  value?: string
  hint?: string
  state?: ConnectionChipState
  href?: string
  compact?: boolean
}

function stateClass(state: ConnectionChipState) {
  switch (state) {
    case 'ok':
      return 'admin-conn-chip--ok'
    case 'warn':
    case 'off':
      return 'admin-conn-chip--warn'
    case 'ready':
      return 'admin-conn-chip--ready'
    case 'loading':
      return 'admin-conn-chip--loading'
    default:
      return 'admin-conn-chip--muted'
  }
}

function StateIcon({ state }: { state: ConnectionChipState }) {
  if (state === 'loading') {
    return <Loader2 className="admin-conn-chip__icon admin-conn-chip__icon--spin" aria-hidden />
  }
  if (state === 'ok' || state === 'ready') {
    return <CheckCircle2 className="admin-conn-chip__icon admin-conn-chip__icon--ok" aria-hidden />
  }
  if (state === 'warn' || state === 'off') {
    return <WifiOff className="admin-conn-chip__icon admin-conn-chip__icon--warn" aria-hidden />
  }
  return <span className="admin-conn-chip__dot" aria-hidden />
}

export function ConnectionChip({ label, value, hint, state = 'muted', href, compact }: ConnectionChipProps) {
  const title = [label, value, hint].filter(Boolean).join(' — ')
  const inner = (
    <>
      {!compact ? <StateIcon state={state} /> : <span className={cn('admin-conn-chip__dot', state === 'ok' && 'admin-conn-chip__dot--on')} />}
      <span className="admin-conn-chip__text">
        <span className="admin-conn-chip__label">{label}</span>
        {value ? <span className="admin-conn-chip__value">{value}</span> : null}
        {hint ? <span className="admin-conn-chip__hint">{hint}</span> : null}
      </span>
    </>
  )

  const className = cn('admin-conn-chip', stateClass(state), compact && 'admin-conn-chip--compact')

  if (href) {
    return (
      <Link href={href} className={className} title={title}>
        {inner}
      </Link>
    )
  }

  return (
    <span className={className} title={title}>
      {inner}
    </span>
  )
}
