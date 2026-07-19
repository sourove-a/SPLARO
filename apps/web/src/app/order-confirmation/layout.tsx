import '@/styles/pages/checkout.css'
import { createNoIndexMetadata } from '@/lib/seo/route-metadata'

export const metadata = createNoIndexMetadata('Order Confirmation')

export default function OrderConfirmationLayout({ children }: { children: React.ReactNode }) {
  return children
}
