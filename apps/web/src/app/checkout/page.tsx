import type { Metadata } from 'next'
import CheckoutPageClient from './page-client'

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Complete your SPLARO order with cash on delivery or SSLCommerz secure checkout.',
}

export default function CheckoutPage() {
  return <CheckoutPageClient />
}
