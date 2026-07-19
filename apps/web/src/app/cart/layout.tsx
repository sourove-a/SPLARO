import '@/styles/pages/cart.css'
import '@/styles/pages/checkout.css'
import '@/styles/pages/shop.css'
import { createNoIndexMetadata } from '@/lib/seo/route-metadata'

export const metadata = createNoIndexMetadata(
  'Your Bag',
  'Review your SPLARO bag and proceed to checkout.',
)

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children
}
