'use client'

import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { isExternalHref, markAdminLinkNavigation } from '@/lib/navigation/client-nav'

type AdminButtonVariant = 'default' | 'gold' | 'ghost' | 'dark' | 'danger' | 'warning' | 'success'
type AdminButtonSize = 'sm' | 'md'

interface AdminButtonBaseProps {
  variant?: AdminButtonVariant
  size?: AdminButtonSize
  className?: string
  children: ReactNode
  loading?: boolean
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
}

function adminBtnClass(
  variant: AdminButtonVariant,
  size: AdminButtonSize,
  className?: string,
  loading?: boolean,
) {
  return cn(variantClass[variant], sizeClass[size], loading && 'admin-btn--loading', className)
}

export function AdminButton({
  variant = 'default',
  size = 'md',
  className,
  children,
  loading,
  disabled,
  ...props
}: AdminButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={adminBtnClass(variant, size, className, loading)}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden /> : null}
      {children}
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
      onClick={() => markAdminLinkNavigation(href)}
      className={adminBtnClass(variant, size, className, loading)}
    >
      {children}
    </Link>
  )
}
