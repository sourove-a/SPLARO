import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

type SharedProps = {
  variant?: ButtonVariant
  fullWidth?: boolean
  compact?: boolean
  className?: string
  children: ReactNode
}

type ButtonAsButton = SharedProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & {
    href?: undefined
  }

type ButtonAsLink = SharedProps & {
  href: string
  prefetch?: boolean
}

export type ButtonProps = ButtonAsButton | ButtonAsLink

function buttonClassName(
  variant: ButtonVariant,
  fullWidth: boolean,
  compact: boolean,
  className?: string,
) {
  return cn(
    'btn',
    `btn--${variant}`,
    fullWidth && 'btn--full',
    compact && 'btn--compact',
    className,
  )
}

/**
 * SPLARO Button System — Primary / Secondary / Ghost / Danger.
 * Never invent one-off button styles; use this.
 */
export function Button(props: ButtonProps) {
  const variant = props.variant ?? 'primary'
  const fullWidth = Boolean(props.fullWidth)
  const compact = Boolean(props.compact)
  const classes = buttonClassName(variant, fullWidth, compact, props.className)

  if ('href' in props && props.href) {
    const { href, children } = props
    if (props.prefetch === undefined) {
      return (
        <Link href={href} className={classes}>
          {children}
        </Link>
      )
    }
    return (
      <Link href={href} prefetch={props.prefetch} className={classes}>
        {children}
      </Link>
    )
  }

  const buttonProps = props as ButtonAsButton
  const { type = 'button', disabled, children, ...rest } = buttonProps

  return (
    <button type={type} disabled={disabled} className={classes} {...rest}>
      {children}
    </button>
  )
}
