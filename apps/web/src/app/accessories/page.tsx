import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AccessoriesClient } from '@/components/accessories/AccessoriesClient'
import { fetchAllAccessories } from '@/lib/catalog/live'

export const metadata: Metadata = {
  title: 'Accessories | SPLARO',
  description:
    'Premium handcrafted accessories — eyewear, bags, jewelry, scarves and more from curated manufacturers.',
}

export const revalidate = 60

interface AccessoriesPageProps {
  searchParams: Promise<{ cat?: string; filter?: string }>
}

export default async function AccessoriesPage({ searchParams }: AccessoriesPageProps) {
  const { cat, filter } = await searchParams
  const { products, total } = await fetchAllAccessories()
  const trimmedFilter = filter?.trim()

  return (
    <Suspense fallback={<div className="accessories-page min-h-[50vh]" />}>
      <AccessoriesClient
        products={products}
        total={total}
        initialCat={cat?.trim() || 'all'}
        {...(trimmedFilter ? { initialFilter: trimmedFilter } : {})}
      />
    </Suspense>
  )
}
