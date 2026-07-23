import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import TrackOrderClient from './page-client'

export const metadata: Metadata = {
  title: 'Track Order',
  description: 'Track your SPLARO orders with the phone number used at checkout.',
}

type TrackOrderPageProps = {
  searchParams: Promise<{
    phone?: string
    invoice?: string
    order?: string
    key?: string
  }>
}

/**
 * Server page passes query prefill — avoids Suspense+useSearchParams empty shell
 * so crawlers / no-JS still see the tracking form in HTML.
 *
 * Signed email links (`invoice` + `key`) skip the form and open confirmation.
 */
export default async function TrackOrderPage({ searchParams }: TrackOrderPageProps) {
  const params = await searchParams
  const invoice = (params.invoice ?? params.order)?.trim()
  const key = params.key?.trim()

  if (invoice && key) {
    redirect(
      `/order-confirmation/${encodeURIComponent(invoice)}?key=${encodeURIComponent(key)}`,
    )
  }

  const initialPhone = params.phone?.trim() ?? ''

  return (
    <TrackOrderClient
      initialPhone={initialPhone}
      initialInvoice={invoice ?? ''}
      initialKey={key ?? ''}
    />
  )
}
