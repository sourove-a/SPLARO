import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { mergeCatalogChannels } from '@splaro/types'
import { getVisibleCollectionCards } from '@/lib/catalog/collection-cards'
import { getStorefrontCatalog } from '@/lib/catalog/server'
import { getStorefrontSettings } from '@/lib/storefront/settings'
import { collectionHref } from '@/lib/storefront/collection-paths'
import { createRouteMetadata } from '@/lib/seo/route-metadata'
import { buildItemListJsonLd } from '@/lib/seo/geo-json-ld'

export const dynamic = 'force-dynamic'

export const metadata = createRouteMetadata({
  title: 'Collections',
  description: 'Curated SPLARO collections — rooms in the wardrobe, not departments.',
  path: '/collections',
})

export default async function CollectionsPage() {
  const [settings, catalog] = await Promise.all([
    getStorefrontSettings(),
    getStorefrontCatalog(),
  ])
  const channels = mergeCatalogChannels(settings.config.catalogChannels ?? [])
  const collectionCards = await getVisibleCollectionCards(channels, catalog)
  const listLd = buildItemListJsonLd({
    name: 'SPLARO collections',
    path: '/collections',
    items: collectionCards.map((card) => ({
      name: card.label,
      path: collectionHref(card.slug),
    })),
  })

  return (
    <main className="shop-page-shell collections-page px-3 sm:px-5 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listLd }} />
      <section className="collections-page__section mx-auto max-w-[1120px]">
        <header className="collections-page__mast">
          <p className="collections-page__eyebrow">Collections</p>
          <h1 className="collections-page__title">Lines with a point of view.</h1>
          <p className="collections-page__lede">
            Curated rooms in the wardrobe — not departments. Order stays on SPLARO.
          </p>
          <div className="collections-page__actions">
            <Link href="/shop" className="collections-page__text-link">
              Shop all products
            </Link>
            <Link href="/" className="collections-page__text-link collections-page__text-link--quiet">
              <ArrowLeft className="h-3.5 w-3.5" />
              Home
            </Link>
          </div>
        </header>

        {collectionCards.length > 0 ? (
          <div className="collections-page__grid">
            {collectionCards.map((card) => (
              <Link
                key={card.slug}
                href={collectionHref(card.slug)}
                className="collections-page__tile group"
              >
                <div className="collections-page__tile-media">
                  <Image
                    src={card.image}
                    alt={card.label}
                    fill
                    sizes="(max-width: 640px) 46vw, 240px"
                    className="collections-page__tile-img object-cover"
                  />
                </div>
                <div className="collections-page__tile-meta">
                  <p className="collections-page__tile-label">{card.label}</p>
                  <p className="collections-page__tile-count">
                    {card.count} {card.count === 1 ? 'piece' : 'pieces'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="collections-page__empty">Collections will appear here as they are published.</p>
        )}
      </section>
    </main>
  )
}
