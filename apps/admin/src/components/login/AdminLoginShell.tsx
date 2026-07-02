'use client'

import { useEffect, type ReactNode } from 'react'
import { AdminAuthEarthBackground } from './AdminAuthEarthBackground'

export function AdminLoginShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.classList.add('admin-auth-page')
    return () => document.body.classList.remove('admin-auth-page')
  }, [])

  return (
    <div className="admin-auth-shell">
      <div className="admin-auth-shell__glow" aria-hidden="true" />
      <AdminAuthEarthBackground />
      <div className="admin-auth-shell__inner">
        <div className="admin-auth-glass-panel">
          <div className="admin-auth-glass-panel__shine" aria-hidden="true" />
          <div className="admin-auth-card">{children}</div>
        </div>
      </div>
    </div>
  )
}
