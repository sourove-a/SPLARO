'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSyncExternalStore, type MouseEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import {
  adminHrefPath,
  getPendingAdminNav,
  isExternalHref,
  markAdminLinkNavigation,
  subscribePendingAdminNav,
} from '@/lib/navigation/client-nav'

interface AdminNavLinkProps {
  href: string
  className?: string
  title?: string | undefined
  children: ReactNode
  onNavigate?: () => void
}

export function AdminNavLink({ href, className, title, children, onNavigate }: AdminNavLinkProps) {
  const pathname = usePathname()
  const pendingHref = useSyncExternalStore(
    subscribePendingAdminNav,
    getPendingAdminNav,
    () => null,
  )

  const hrefPath = adminHrefPath(href)
  const active =
    pathname === hrefPath || (hrefPath !== '/dashboard' && pathname.startsWith(`${hrefPath}/`))
  const pending =
    pendingHref != null &&
    (adminHrefPath(pendingHref) === hrefPath || pendingHref === href)

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
      aria-busy={pending || undefined}
      className={cn(
        'admin-nav-item',
        active && 'admin-nav-item--active',
        pending && 'admin-nav-item--pending',
        className,
      )}
    >
      {children}
    </Link>
  )
}
