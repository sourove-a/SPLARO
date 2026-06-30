import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import { filterCollectionCards, mergeCatalogChannels } from '@splaro/types'
import { collectionCards } from '@/data/storefront'
import { getStorefrontCatalog } from '@/lib/catalog/server'
import { getStorefrontSettings } from '@/lib/storefront/settings'
import { collectionHref } from '@/lib/storefront/collection-paths'

function countForSlug(
  slug: string,
  shopCategory: string | undefined,
  products: Array<{ category: string }>,
) {
  if (shopCategory) {
    return products.filter((product) => product.category === shopCategory).length
  }
  return products.filter(
    (product) => product.category.toLowerCase().replace(/\s+/g, '-') === slug,
  ).length
}

export default async function CollectionsPage() {
  const [settings, catalog] = await Promise.all([
    getStorefrontSettings(),
    getStorefrontCatalog(),
  ])
  const channels = mergeCatalogChannels(settings.config.catalogChannels ?? [])
  const visibleCards = filterCollectionCards(collectionCards, channels).map((card) => {
    const channel = channels.find((entry) => entry.slug === card.slug)
    const liveCount = countForSlug(card.slug, channel?.shopCategory, catalog.products)
    return {
      ...card,
      count: catalog.source === 'api' && liveCount > 0 ? liveCount : card.count,
    }
  })

  return (
    <main className="shop-page-shell collections-page px-3 sm:px-5 lg:px-8">
      <section className="collections-page__section mx-auto max-w-[1720px]">
        <div className="collections-page__hero shop-hero__glass">
          <div className="collections-page__hero-copy">
            <p className="shop-hero__eyebrow label-luxury">SPLARO Collections</p>
            <h1 className="collections-page__title">Choose your edit</h1>
            <p className="shop-hero__subtitle">
              {visibleCards.length > 0
                ? 'Each collection opens a filtered shop with size, colour, and price filters.'
                : 'Browse the full catalog while collections are being refreshed.'}
            </p>
          </div>
          <Link href="/shop" className="shop-hero__promo glass">
            <p className="shop-hero__promo-label label-luxury">Full catalog</p>
            <p className="shop-hero__promo-text">Shop all products</p>
            <span className="shop-hero__promo-link">
              Browse now
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>

        {visibleCards.length > 0 ? (
          <div className="collections-page__grid">
            {visibleCards.map((card) => (
              <Link
                key={card.slug}
                href={collectionHref(card.slug)}
                className="shop-collection-card group"
              >
                <div className="shop-collection-card__media shop-collection-card__media--wide">
                  <Image
                    src={card.image}
                    alt={card.label}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="shop-collection-card__img object-cover"
                  />
                  <div className="shop-collection-card__shine" aria-hidden />
                  <div className="shop-collection-card__overlay" aria-hidden />
                  <div className="shop-collection-card__footer">
                    <div className="shop-collection-card__text">
                      <p className="shop-collection-card__label">{card.label}</p>
                      <p className="shop-collection-card__count">{card.count} pieces</p>
                    </div>
                    <span className="shop-collection-card__arrow" aria-hidden>
                      <ArrowUpRight strokeWidth={1.5} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="glass mt-6 rounded-[1.4rem] px-6 py-10 text-center">
            <p className="text-sm font-bold text-luxury-gray">No collections are published right now.</p>
            <Link href="/shop" className="btn-luxury-outline mt-5 inline-flex items-center gap-2">
              Shop all products
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        <Link href="/" className="collections-page__back btn-luxury-outline mt-8 inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </section>
    </main>
  )
}
