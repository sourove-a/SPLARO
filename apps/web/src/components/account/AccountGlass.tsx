'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { useLuxuryTilt } from '@/hooks/useLuxuryTilt'

type AccountGlassProps = {
  children: ReactNode
  className?: string
  center?: boolean
  /** Gentle 2° mouse-follow — heroes only; off by default for dense lists. */
  tilt?: boolean
}

export function AccountGlass({ children, className, center, tilt = false }: AccountGlassProps) {
  const { ref, onPointerMove, onPointerLeave } = useLuxuryTilt<HTMLDivElement>({
    enabled: tilt,
  })

  return (
    <div
      ref={ref}
      className={cn(
        'account-glass',
        tilt && 'account-glass--tilt',
        center && 'account-glass--center',
        className,
      )}
      onPointerMove={tilt ? onPointerMove : undefined}
      onPointerLeave={tilt ? onPointerLeave : undefined}
    >
      <div className="account-glass__surface" aria-hidden="true" />
      <div className="account-glass__sheen" aria-hidden="true" />
      <div className="account-glass__body">{children}</div>
    </div>
  )
}
