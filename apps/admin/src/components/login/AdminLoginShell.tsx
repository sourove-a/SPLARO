'use client'

import { useLayoutEffect, type ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import { SplaroAdminLogo } from '@/components/brand/SplaroAdminLogo'
import { AdminAuthEarthBackground } from '@/components/login/AdminAuthEarthBackground'

const STOREFRONT_URL =
  process.env.NEXT_PUBLIC_WEB_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  'https://splaro.co'

export function AdminLoginShell({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    document.body.classList.add('admin-auth-page')
    document.documentElement.classList.remove('dark')
    return () => document.body.classList.remove('admin-auth-page')
  }, [])

  return (
    <div className="admin-auth-shell">
      <div className="admin-auth-shell__glow" aria-hidden="true" />
      <AdminAuthEarthBackground />

      <header className="admin-auth-topbar">
        <a
          href={STOREFRONT_URL}
          className="admin-auth-topbar__link"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink className="h-4 w-4" strokeWidth={2.2} aria-hidden />
          Storefront
        </a>
      </header>

      <div className="admin-auth-shell__inner admin-auth-template-enter">
        <div className="admin-auth-shell__logo">
          <SplaroAdminLogo variant="login" priority />
        </div>

        <div className="admin-auth-glass-panel">
          <div className="admin-auth-glass-panel__shine" aria-hidden="true" />
          <div className="admin-auth-card">{children}</div>
        </div>
      </div>
    </div>
  )
}
