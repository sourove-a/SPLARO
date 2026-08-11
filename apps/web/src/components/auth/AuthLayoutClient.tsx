'use client'

import { Suspense, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { AuthExperience } from '@/components/auth/AuthExperience'
import { AuthExperienceErrorBoundary } from '@/components/auth/AuthExperienceErrorBoundary'
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

  // GoogleOAuthProvider lives in root Providers (AuthGoogleProvider) —
  // do not nest a second GIS instance here (One Tap + login button share one).
  return (
    <AuthShell>
      {passwordFlow ? (
        children
      ) : (
        <AuthExperienceErrorBoundary>
          <Suspense fallback={<AuthExperienceFallback />}>
            <AuthExperience />
          </Suspense>
        </AuthExperienceErrorBoundary>
      )}
    </AuthShell>
  )
}
