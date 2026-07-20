import type { Metadata } from 'next'
import { Suspense } from 'react'
import { orderDocumentTitle } from '@splaro/config'
import OrderConfirmationPageClient from './page-client'

interface OrderConfirmationPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: OrderConfirmationPageProps): Promise<Metadata> {
  const { id } = await params
  return {
    title: orderDocumentTitle(id),
    description: 'Look up your SPLARO order status.',
  }
}

export default async function OrderConfirmationPage({ params }: OrderConfirmationPageProps) {
  const { id } = await params
  return (
    <Suspense
      fallback={
        <main className="checkout-shell checkout-shell--loading">
          <div className="checkout-glass-panel checkout-glass-panel--center">
            <p className="text-sm font-black text-black/55">Loading order...</p>
          </div>
        </main>
      }
    >
      <OrderConfirmationPageClient orderId={id} />
    </Suspense>
  )
}
