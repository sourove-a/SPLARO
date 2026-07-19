import type { Metadata } from 'next'
import CheckoutPageClient from './page-client'

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Complete your SPLARO order with secure cash on delivery.',
  robots: { index: false, follow: false },
}

export default function CheckoutPage() {
  return <CheckoutPageClient />
}
