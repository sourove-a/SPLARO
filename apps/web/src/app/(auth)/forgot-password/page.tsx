import type { Metadata } from 'next'
import { Suspense } from 'react'
import ForgotPasswordPageClient from './page-client'

export const metadata: Metadata = {
  title: 'Forgot password',
  description: 'Reset your SPLARO account password.',
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-card auth-card--loading" aria-busy="true" aria-label="Loading reset form" />
      }
    >
      <ForgotPasswordPageClient />
    </Suspense>
  )
}
