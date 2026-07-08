import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Page Not Found',
}

export default function NotFound() {
  return (
    <div className="not-found-shell">
      <div className="not-found-shell__ambient" aria-hidden="true" />
      <div className="not-found-glass">
        <p className="not-found-code">404</p>
        <h1 className="not-found-title">Page Not Found</h1>
        <p className="not-found-text">
          The page you are looking for may have moved or no longer exists.
        </p>
        <Link href="/" className="account-btn account-btn--primary not-found-btn">
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Return Home
        </Link>
      </div>
    </div>
  )
}
