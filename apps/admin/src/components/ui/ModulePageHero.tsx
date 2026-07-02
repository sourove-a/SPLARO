'use client'

import { cn } from '@/lib/utils/cn'

interface ModulePageHeroProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}

export function ModulePageHero({ eyebrow, title, description, actions, className }: ModulePageHeroProps) {
  return (
    <section className={cn('admin-module-hero', className)}>
      <div>
        {eyebrow ? <p className="admin-module-hero__eyebrow">{eyebrow}</p> : null}
        <h2 className="admin-module-hero__title">{title}</h2>
        {description ? <p className="admin-module-hero__desc">{description}</p> : null}
      </div>
      {actions ? <div className="admin-module-hero__actions">{actions}</div> : null}
    </section>
  )
}
