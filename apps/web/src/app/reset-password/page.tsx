import type { Metadata } from 'next'
import { Suspense } from 'react'
import ResetPasswordPageClient from './page-client'

export const metadata: Metadata = {
  title: 'Reset password',
  description: 'Create a new password for your SPLARO account.',
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPageClient />
    </Suspense>
  )
}
