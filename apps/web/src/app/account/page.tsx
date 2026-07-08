import type { Metadata } from 'next'
import { Suspense } from 'react'
import AccountDashboard from './page-client'

export const metadata: Metadata = {
  title: 'My Account',
  description: 'Manage your SPLARO orders, addresses, and account settings.',
}

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountDashboard />
    </Suspense>
  )
}
