'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { ProductCard } from '@/components/product/ProductCard/ProductCard'
import type { ProductCardData } from '@splaro/types'

export default function SearchPageClient() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const [results, setResults] = useState<ProductCardData[]>([])
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setSearchError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setSearchError(null)

    fetch(`/api/search?q=${encodeURIComponent(query)}`, { cache: 'no-store' })
      .then(async (res) => {
        const payload = (await res.json()) as {
          products?: ProductCardData[]
          error?: string
        }
        if (!res.ok) {
          throw new Error(payload.error ?? 'Search service offline')
        }
        if (!cancelled) {
          setResults(payload.products ?? [])
          setSearchError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResults([])
          setSearchError(
            err instanceof Error ? err.message : 'Search is temporarily offline — try again shortly.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [query])

  const displayResults = query ? results : []

  return (
    <div className="search-page account-shell">
      <div className="account-shell__ambient" aria-hidden="true" />

      <div className="search-page__layout">
        <header className="search-page__header account-glass">
          <p className="search-page__eyebrow">Search</p>
          <h1 className="search-page__title">
            {query ? `Results for “${query}”` : 'Search SPLARO'}
          </h1>
          <p className="search-page__subtitle">
            {loading
              ? 'Searching…'
              : searchError
                ? 'Search unavailable'
                : query
                  ? `${displayResults.length} ${displayResults.length === 1 ? 'product' : 'products'} found`
                  : 'Enter a search term from the header to find products.'}
          </p>
          <form action="/search" method="get" className="search-page__form">
            <Search className="h-4 w-4" strokeWidth={2.1} />
            <input
              name="q"
              defaultValue={query}
              placeholder="Search products, categories..."
              className="search-page__input"
            />
            <button type="submit" className="search-page__submit">
              Search
            </button>
          </form>
        </header>

        {searchError ? (
          <div className="search-page__empty account-glass">
            <p className="auth-form__error">{searchError}</p>
          </div>
        ) : null}

        {query && !loading && !searchError && displayResults.length === 0 ? (
          <div className="search-page__empty account-glass">
            <p>No products matched your search.</p>
            <Link href="/shop" className="search-page__link">
              Browse all products
            </Link>
          </div>
        ) : null}

        {displayResults.length > 0 ? (
          <div className="search-page__grid">
            {displayResults.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
