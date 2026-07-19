import type { Metadata } from 'next'
import { PaymentResult } from '@/components/payment/PaymentResult'

export const metadata: Metadata = {
  title: 'Payment cancelled',
  robots: { index: false, follow: false },
}

export default async function PaymentCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string; key?: string }>
}) {
  const { invoice, key } = await searchParams
  const normalizedInvoice = invoice?.trim()
  const accessKey = key?.trim()
  return (
    <PaymentResult
      kind="cancelled"
      {...(normalizedInvoice ? { invoice: normalizedInvoice } : {})}
      {...(accessKey ? { accessKey } : {})}
    />
  )
}
