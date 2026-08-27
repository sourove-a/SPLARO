import type { Metadata } from 'next'
import { UnsubscribeClient } from './unsubscribe-client'
import '@/styles/pages/content.css'
import '@/styles/pages/account.css'

export const metadata: Metadata = {
  title: 'Remove stock reminder',
  description: 'Stop the back-in-stock reminder for an item you asked about.',
  robots: { index: false, follow: false },
}

export default async function StockAlertUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  return (
    <div className="not-found-shell">
      <div className="not-found-shell__ambient" aria-hidden="true" />
      <div className="not-found-glass">
        <UnsubscribeClient token={token ?? ''} />
      </div>
    </div>
  )
}
