'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import type { CollectionCard } from '@/data/storefront'
import { collectionHref } from '@/lib/storefront/collection-paths'

interface ShopCollectionsSectionProps {
  cards: CollectionCard[]
}

export function ShopCollectionsSection({ cards }: ShopCollectionsSectionProps) {
  // Empty collections render as a placeholder-bag card with "0 pieces" — reads
  // as a broken storefront, so only show collections that actually have stock.
  const stocked = cards.filter((card) => card.count > 0)
  if (!stocked.length) return null

  return (
    <section className="shop-collections" aria-labelledby="shop-collections-heading">
      <div className="shop-collections__inner">
        <div className="shop-collections__header">
          <h2 id="shop-collections-heading" className="shop-collections__title">
            Collections
          </h2>
          <Link href="/collections" className="shop-collections__link">
            View all
            <ArrowRight className="shop-collections__link-icon" strokeWidth={1.5} />
          </Link>
        </div>

        <div className="shop-collections__row" data-lenis-prevent>
          {stocked.map((card) => (
            <Link
              key={card.slug}
              href={collectionHref(card.slug)}
              className="shop-collection-card group"
            >
              <div className="shop-collection-card__media">
                <Image
                  src={card.image}
                  alt={card.label}
                  fill
                  sizes="(max-width: 1024px) 42vw, 16vw"
                  className="shop-collection-card__img object-cover"
                />
                <div className="shop-collection-card__shine" aria-hidden />
                <div className="shop-collection-card__overlay" aria-hidden />
                <div className="shop-collection-card__footer">
                  <div className="shop-collection-card__text">
                    <p className="shop-collection-card__label">{card.label}</p>
                    <p className="shop-collection-card__count">
                      {card.count} {card.count === 1 ? 'piece' : 'pieces'}
                    </p>
                  </div>
                  <span className="shop-collection-card__arrow" aria-hidden>
                    <ArrowUpRight strokeWidth={1.5} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
