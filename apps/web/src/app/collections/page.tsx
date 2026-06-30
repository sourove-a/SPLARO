import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { filterCollectionCards } from '@splaro/types'
import { collectionCards } from '@/data/storefront'
import { getStorefrontSettings } from '@/lib/storefront/settings'
import { collectionHref } from '@/lib/storefront/collection-paths'

export default async function CollectionsPage() {
  const settings = await getStorefrontSettings()
  const channels = settings.config.catalogChannels ?? []
  const visibleCards = filterCollectionCards(collectionCards, channels)

  return (
    <main className="shop-page-shell px-3 sm:px-5 lg:px-8">
      <section className="mx-auto max-w-[1720px]">
        <div className="shop-hero__glass">
          <div>
            <p className="shop-hero__eyebrow">SPLARO Collections</p>
            <h1 className="shop-hero__title">Choose your edit</h1>
            <p className="shop-hero__subtitle">
              {visibleCards.length > 0
                ? 'Each collection opens a filtered shop with size, colour, and price filters.'
                : 'Browse the full catalog while collections are being refreshed.'}
            </p>
          </div>
          <Link href="/shop" className="shop-hero__promo">
            <p className="shop-hero__promo-label">Full catalog</p>
            <p className="shop-hero__promo-text">Shop all products</p>
            <span className="shop-hero__promo-link">
              Browse now
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>

        {visibleCards.length > 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCards.map((card) => (
              <Link
                key={card.slug}
                href={collectionHref(card.slug)}
                className="shop-collection-card group !flex-none"
              >
                <div className="shop-collection-card__media !aspect-[16/10]">
                  <Image
                    src={card.image}
                    alt={card.label}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="shop-collection-card__overlay" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-lg font-black text-white">{card.label}</p>
                    <p className="text-xs font-bold text-white/75">{card.count} pieces</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[1.4rem] border border-black/8 bg-white/70 px-6 py-10 text-center backdrop-blur-xl">
            <p className="text-sm font-bold text-black/55">No collections are published right now.</p>
            <Link href="/shop" className="glass-action mt-5 inline-flex">
              Shop all products
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        <Link href="/" className="glass-action mt-8">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </section>
    </main>
  )
}
