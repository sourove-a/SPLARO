'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { MouseEvent, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { isExternalHref, markAdminLinkNavigation } from '@/lib/navigation/client-nav'

interface AdminNavLinkProps {
  href: string
  className?: string
  title?: string | undefined
  children: ReactNode
  onNavigate?: () => void
}

export function AdminNavLink({ href, className, title, children, onNavigate }: AdminNavLinkProps) {
  const pathname = usePathname()

  const active =
    pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`))

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return
    }

    markAdminLinkNavigation(href)
    onNavigate?.()
  }

  if (isExternalHref(href)) {
    return (
      <a
        href={href}
        title={title}
        target="_blank"
        rel="noopener noreferrer"
        className={cn('admin-nav-item', className)}
      >
        {children}
      </a>
    )
  }

  return (
    <Link
      href={href}
      title={title}
      scroll={false}
      prefetch
      onClick={handleClick}
      aria-current={active ? 'page' : undefined}
      className={cn('admin-nav-item', active && 'admin-nav-item--active', className)}
    >
      {children}
    </Link>
  )
}
