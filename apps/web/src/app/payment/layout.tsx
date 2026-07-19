import type { ReactNode } from 'react'
import '@/styles/pages/checkout.css'

export default function PaymentLayout({ children }: { children: ReactNode }) {
  return <main className="checkout-shell">{children}</main>
}
