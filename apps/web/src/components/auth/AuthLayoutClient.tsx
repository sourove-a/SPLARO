'use client'

import { Suspense, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { AuthExperience } from '@/components/auth/AuthExperience'
import { AuthGoogleProvider } from '@/components/auth/AuthGoogleProvider'
import { AuthShell } from '@/components/auth/AuthShell'

function AuthExperienceFallback() {
  return <div className="auth-card auth-card--loading" aria-busy="true" aria-label="Loading account" />
}

function isPasswordResetPath(pathname: string): boolean {
  return (
    pathname === '/forgot-password' ||
    pathname.startsWith('/forgot-password/') ||
    pathname === '/reset-password' ||
    pathname.startsWith('/reset-password/')
  )
}

export function AuthLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const passwordFlow = isPasswordResetPath(pathname)

  return (
    <AuthGoogleProvider>
      <AuthShell>
        {passwordFlow ? (
          children
        ) : (
          <Suspense fallback={<AuthExperienceFallback />}>
            <AuthExperience />
          </Suspense>
        )}
      </AuthShell>
    </AuthGoogleProvider>
  )
}
