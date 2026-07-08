import type { Metadata } from 'next'
import { CartPageClient } from './page-client'

export const metadata: Metadata = {
  title: 'Your Bag',
  description: 'Review your SPLARO bag and proceed to checkout.',
}

export default function CartPage() {
  return <CartPageClient />
}
