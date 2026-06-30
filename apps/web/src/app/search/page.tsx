import type { Metadata } from 'next'
import { Suspense } from 'react'
import SearchPageClient from './search-page-client'

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search SPLARO products across Summer Edition, Men, Women, Kids, and Footwear.',
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="search-page account-shell account-shell--loading">
          <div className="account-glass account-glass--center">
            <p className="text-sm font-black text-black/55">Searching...</p>
          </div>
        </div>
      }
    >
      <SearchPageClient />
    </Suspense>
  )
}
