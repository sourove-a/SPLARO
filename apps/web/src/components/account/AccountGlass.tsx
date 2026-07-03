import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

type AccountGlassProps = {
  children: ReactNode
  className?: string
  center?: boolean
}

export function AccountGlass({ children, className, center }: AccountGlassProps) {
  return (
    <div className={cn('account-glass', center && 'account-glass--center', className)}>
      <div className="account-glass__surface" aria-hidden="true" />
      <div className="account-glass__sheen" aria-hidden="true" />
      <div className="account-glass__body">{children}</div>
    </div>
  )
}
