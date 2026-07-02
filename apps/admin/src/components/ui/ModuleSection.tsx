import { cn } from '@/lib/utils/cn'

interface ModuleSectionProps {
  title: string
  hint?: string
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'accent'
}

export function ModuleSection({ title, hint, children, className, variant = 'default' }: ModuleSectionProps) {
  return (
    <section
      className={cn(
        'admin-module-section',
        variant === 'accent' && 'border-[var(--admin-brand-gold-border)] bg-gradient-to-br from-[var(--admin-brand-gold-muted)] to-transparent',
        className,
      )}
    >
      <header className="admin-module-section__head">
        <h4 className="admin-module-section__title">{title}</h4>
        {hint ? <p className="admin-module-section__hint">{hint}</p> : null}
      </header>
      <div className="admin-module-section__body">{children}</div>
    </section>
  )
}
