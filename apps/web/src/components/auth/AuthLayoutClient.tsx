'use client'

import { Suspense, type ReactNode } from 'react'
import { AuthExperience } from '@/components/auth/AuthExperience'
import { AuthShell } from '@/components/auth/AuthShell'

function AuthExperienceFallback() {
  return <div className="auth-card auth-card--loading" aria-busy="true" aria-label="Loading account" />
}

export function AuthLayoutClient({ children: _children }: { children: ReactNode }) {
  return (
    <AuthShell>
      <Suspense fallback={<AuthExperienceFallback />}>
        <AuthExperience />
      </Suspense>
    </AuthShell>
  )
}
