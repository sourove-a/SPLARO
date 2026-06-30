'use client'

import Link from 'next/link'
import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { isExternalHref, markAdminLinkNavigation } from '@/lib/navigation/client-nav'

type AdminButtonVariant = 'default' | 'gold' | 'ghost' | 'dark'

interface AdminButtonBaseProps {
  variant?: AdminButtonVariant
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
}

export function AdminButton({
  variant = 'default',
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
      className={cn(variantClass[variant], loading && 'admin-btn--loading', className)}
    >
      {children}
    </button>
  )
}

export function AdminLinkButton({
  href,
  variant = 'default',
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
        className={cn(variantClass[variant], className)}
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
      className={cn(variantClass[variant], loading && 'admin-btn--loading', className)}
    >
      {children}
    </Link>
  )
}
