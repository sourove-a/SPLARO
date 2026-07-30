'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface HandoffPageChromeProps {
  group: string
  title: string
  sync?: string
  live?: boolean
  offline?: boolean
  actions?: ReactNode
  className?: string
  children?: ReactNode
}

/** Handoff module page chrome: Group › Title + LIVE + sync + action row. */
export function HandoffPageChrome({
  group,
  title,
  sync,
  live = true,
  offline = false,
  actions,
  className,
  children,
}: HandoffPageChromeProps) {
  return (
    <div className={cn('ho-stack', className)}>
      <div className="ho-page-chrome">
        <div className="min-w-0">
          <p className="ho-page-chrome__crumb">
            {group} › {title}
          </p>
          <h1 className="ho-page-chrome__title">{title}</h1>
          <div className="ho-page-chrome__meta">
            {offline ? (
              <span className="ho-live-chip ho-live-chip--warn">Offline</span>
            ) : live ? (
              <span className="ho-live-chip">
                <span className="ho-live-chip__dot" aria-hidden />
                Live
              </span>
            ) : null}
            {sync ? <span className="ho-sync">{sync}</span> : null}
          </div>
        </div>
        {actions ? <div className="ho-page-chrome__actions">{actions}</div> : null}
      </div>
      {children}
    </div>
  )
}
