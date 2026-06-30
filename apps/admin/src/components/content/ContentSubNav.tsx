'use client'

import {
  BookOpen,
  CheckCircle2,
  FileEdit,
  Footprints,
  Home,
  LayoutTemplate,
  Loader2,
  Menu,
  Newspaper,
  Palette,
  Scale,
  SlidersHorizontal,
  Video,
} from 'lucide-react'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { cn } from '@/lib/utils/cn'

type RouteStatus = 'ok' | 'warn' | 'down' | 'loading'

export const CONTENT_ROUTES = [
  { href: '/dashboard/home-page', label: 'Home Page', icon: Home },
  { href: '/dashboard/footwear-page', label: 'Footwear', icon: Footprints },
  { href: '/dashboard/theme-builder', label: 'Theme', icon: Palette },
  { href: '/dashboard/menu-control', label: 'Menu', icon: Menu },
  { href: '/dashboard/hero-slider', label: 'Hero Slider', icon: SlidersHorizontal },
  { href: '/dashboard/lookbooks', label: 'Lookbooks', icon: BookOpen },
  { href: '/dashboard/reels', label: 'Reels', icon: Video },
  { href: '/dashboard/blog', label: 'Blog', icon: Newspaper },
  { href: '/dashboard/legal-pages', label: 'Legal', icon: Scale },
  { href: '/dashboard/cms', label: 'CMS', icon: FileEdit },
  { href: '/dashboard/landing-pages', label: 'Landing', icon: LayoutTemplate },
] as const

export function ContentSubNav({
  activeHref,
  statusByHref,
}: {
  activeHref: string
  statusByHref?: Partial<Record<string, RouteStatus>>
}) {
  return (
    <nav className="ops-subnav" aria-label="Content modules">
      {CONTENT_ROUTES.map(({ href, label, icon: Icon }) => {
        const active = activeHref === href
        const status = statusByHref?.[href] ?? 'ok'
        return (
          <AdminNavLink key={href} href={href} className={cn('ops-subnav__link', active && 'ops-subnav__link--active')}>
            <Icon className="ops-subnav__icon" strokeWidth={2} />
            <span>{label}</span>
            {status === 'loading' ? (
              <Loader2 className="ops-subnav__status ops-subnav__status--loading" />
            ) : status === 'down' ? (
              <span className="ops-subnav__status ops-subnav__status--down" />
            ) : status === 'warn' ? (
              <span className="ops-subnav__status ops-subnav__status--warn" />
            ) : (
              <CheckCircle2 className="ops-subnav__status ops-subnav__status--ok" />
            )}
          </AdminNavLink>
        )
      })}
    </nav>
  )
}
