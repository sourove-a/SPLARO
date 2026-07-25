import type { Metadata } from 'next'
import { Suspense } from 'react'
import VerifyEmailPageClient from './page-client'

export const metadata: Metadata = {
  title: 'Verify email',
  description: 'Confirm your SPLARO account email.',
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-card auth-card--loading" aria-busy="true" aria-label="Verifying email" />
      }
    >
      <VerifyEmailPageClient />
    </Suspense>
  )
}
