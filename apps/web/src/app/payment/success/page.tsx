import type { Metadata } from 'next'
import { PaymentResult } from '@/components/payment/PaymentResult'

export const metadata: Metadata = {
  title: 'Payment verification',
  robots: { index: false, follow: false },
}

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string; key?: string }>
}) {
  const { invoice, key } = await searchParams
  const normalizedInvoice = invoice?.trim()
  const accessKey = key?.trim()
  return (
    <PaymentResult
      kind="success"
      {...(normalizedInvoice ? { invoice: normalizedInvoice } : {})}
      {...(accessKey ? { accessKey } : {})}
    />
  )
}
