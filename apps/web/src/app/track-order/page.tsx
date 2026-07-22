import type { Metadata } from 'next'
import TrackOrderClient from './page-client'

export const metadata: Metadata = {
  title: 'Track Order',
  description: 'Track your SPLARO orders with the phone number used at checkout.',
}

type TrackOrderPageProps = {
  searchParams: Promise<{
    phone?: string
  }>
}

/**
 * Server page passes query prefill — avoids Suspense+useSearchParams empty shell
 * so crawlers / no-JS still see the tracking form in HTML.
 */
export default async function TrackOrderPage({ searchParams }: TrackOrderPageProps) {
  const params = await searchParams
  const initialPhone = params.phone?.trim() ?? ''

  return <TrackOrderClient initialPhone={initialPhone} />
}
