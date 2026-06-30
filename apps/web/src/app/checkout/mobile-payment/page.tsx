import type { Metadata } from 'next'
import MobilePaymentPageClient from './page-client'

export const metadata: Metadata = {
  title: 'Complete payment',
  description: 'Finish your SPLARO order with bKash or Nagad.',
}

interface MobilePaymentPageProps {
  searchParams: Promise<{
    orderId?: string
    provider?: string
    paymentId?: string
  }>
}

export default async function MobilePaymentPage({ searchParams }: MobilePaymentPageProps) {
  const params = await searchParams
  return (
    <MobilePaymentPageClient
      orderId={params.orderId ?? ''}
      provider={params.provider ?? ''}
      paymentId={params.paymentId ?? ''}
    />
  )
}
