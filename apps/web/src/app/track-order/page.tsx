import type { Metadata } from 'next'
import { Suspense } from 'react'
import TrackOrderClient from './page-client'

export const metadata: Metadata = {
  title: 'Track Order',
  description: 'Track your SPLARO orders by phone number and view your complete order history.',
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={<main className="track-page min-h-screen" />}>
      <TrackOrderClient />
    </Suspense>
  )
}
