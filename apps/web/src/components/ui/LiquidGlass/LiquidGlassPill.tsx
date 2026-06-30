'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

type BaseProps = {
  children: React.ReactNode
  active?: boolean
  unavailable?: boolean
  gold?: boolean
  ghost?: boolean
  size?: 'sm' | 'md' | 'lg'
  square?: boolean
  emoji?: string
  className?: string
  'aria-label'?: string
}

type LinkPillProps = BaseProps & {
  href: string
  onClick?: () => void
  disabled?: never
}

type ButtonPillProps = BaseProps & {
  href?: never
  onClick?: () => void
  disabled?: boolean
}

export type LiquidGlassPillProps = LinkPillProps | ButtonPillProps

function pillClasses(opts: {
  active?: boolean
  unavailable?: boolean
  gold?: boolean
  ghost?: boolean
  size?: 'sm' | 'md' | 'lg'
  square?: boolean
  className?: string
}) {
  const { active, unavailable, gold, ghost, size = 'md', square, className } = opts
  return cn(
    'lg-pill',
    size === 'sm' && 'lg-pill--sm',
    size === 'lg' && 'lg-pill--lg',
    square && 'lg-pill--sq',
    active && 'lg-pill--active',
    unavailable && 'lg-pill--unavailable',
    gold && !active && !unavailable && 'lg-pill--gold',
    ghost && !active && !unavailable && 'lg-pill--ghost',
    className,
  )
}

function PillContent({
  emoji,
  unavailable,
  children,
}: {
  emoji?: string | undefined
  unavailable?: boolean | undefined
  children: React.ReactNode
}) {
  return (
    <>
      {emoji ? <span className="lg-pill__emoji" aria-hidden>{emoji}</span> : null}
      <span className={cn(unavailable && 'lg-pill__strike')}>{children}</span>
    </>
  )
}

export function LiquidGlassPill(props: LiquidGlassPillProps) {
  const {
    children,
    active = false,
    unavailable = false,
    gold = false,
    ghost = false,
    size = 'md',
    square = false,
    emoji,
    className,
    'aria-label': ariaLabel,
  } = props

  const classes = pillClasses({
    active,
    unavailable,
    gold,
    ghost,
    size,
    square,
    ...(className ? { className } : {}),
  })

  if ('href' in props && props.href) {
    return (
      <Link
        href={props.href}
        className={classes}
        {...(props.onClick ? { onClick: props.onClick } : {})}
        {...(active ? { 'aria-current': 'page' as const } : {})}
        {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
        {...(active ? { 'data-active': true } : {})}
      >
        <PillContent emoji={emoji} unavailable={unavailable}>{children}</PillContent>
      </Link>
    )
  }

  return (
    <button
      type="button"
      className={classes}
      {...(props.onClick ? { onClick: props.onClick } : {})}
      disabled={props.disabled || unavailable}
      aria-pressed={active}
      {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
      {...(active ? { 'data-active': true } : {})}
    >
      <PillContent emoji={emoji} unavailable={unavailable}>{children}</PillContent>
    </button>
  )
}
