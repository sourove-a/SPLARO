'use client'

import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { isExternalHref, markAdminLinkNavigation } from '@/lib/navigation/client-nav'
import SpecularButton from '@/components/ui/SpecularButton'

type AdminButtonVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'gold'
  | 'ghost'
  | 'dark'
  | 'danger'
  | 'warning'
  | 'success'
type AdminButtonSize = 'sm' | 'md' | 'lg'

interface AdminButtonBaseProps {
  variant?: AdminButtonVariant
  size?: AdminButtonSize
  className?: string
  children: ReactNode
  loading?: boolean
  /** Square icon control — requires aria-label. */
  iconOnly?: boolean
  /**
   * Force specular glass edge (WebGL). Default OFF — WebGL-per-button caused
   * click lag across the admin. Opt-in only for flagship CTAs.
   */
  specular?: boolean
}

type AdminButtonProps = AdminButtonBaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: never
  }

type AdminLinkButtonProps = AdminButtonBaseProps & {
  href: string
  external?: boolean
}

const variantClass: Record<AdminButtonVariant, string> = {
  default: 'admin-btn',
  primary: 'admin-btn admin-btn--primary',
  secondary: 'admin-btn admin-btn--secondary',
  gold: 'admin-btn admin-btn--gold',
  ghost: 'admin-btn admin-btn--ghost',
  dark: 'admin-btn admin-btn--dark',
  danger: 'admin-btn admin-btn--danger',
  warning: 'admin-btn admin-btn--warning',
  success: 'admin-btn admin-btn--success',
}

const sizeClass: Record<AdminButtonSize, string | undefined> = {
  md: undefined,
  sm: 'admin-btn--sm',
  lg: 'admin-btn--lg',
}

const SPECULAR_VARIANTS: ReadonlySet<AdminButtonVariant> = new Set([])

function adminBtnClass(
  variant: AdminButtonVariant,
  size: AdminButtonSize,
  className?: string,
  loading?: boolean,
) {
  return cn(variantClass[variant], sizeClass[size], loading && 'admin-btn--loading', className)
}

function shouldUseSpecular(
  variant: AdminButtonVariant,
  iconOnly: boolean | undefined,
  specular: boolean | undefined,
) {
  if (iconOnly) return false
  if (specular === true) return true
  if (specular === false) return false
  return SPECULAR_VARIANTS.has(variant)
}

export function AdminButton({
  variant = 'default',
  size = 'md',
  className,
  children,
  loading,
  disabled,
  iconOnly,
  specular,
  ...props
}: AdminButtonProps) {
  const content = (
    <>
      {loading ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden /> : null}
      {loading && iconOnly ? null : children}
    </>
  )

  if (shouldUseSpecular(variant, iconOnly, specular)) {
    return (
      <SpecularButton
        type="button"
        size={size}
        theme="auto"
        followMouse
        autoAnimate={false}
        proximity={220}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(loading && 'admin-btn--loading', className)}
        {...props}
      >
        {content}
      </SpecularButton>
    )
  }

  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={adminBtnClass(
        variant,
        size,
        cn(iconOnly && 'admin-btn--icon', className),
        loading,
      )}
    >
      {content}
    </button>
  )
}

export function AdminLinkButton({
  href,
  variant = 'default',
  size = 'md',
  className,
  children,
  external,
  loading,
}: AdminLinkButtonProps & { loading?: boolean }) {
  if (external || isExternalHref(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-busy={loading || undefined}
        aria-disabled={loading || undefined}
        className={adminBtnClass(variant, size, className, loading)}
      >
        {children}
      </a>
    )
  }

  return (
    <Link
      href={href}
      scroll={false}
      prefetch
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={() => markAdminLinkNavigation(href)}
      className={adminBtnClass(variant, size, className, loading)}
    >
      {children}
    </Link>
  )
}
