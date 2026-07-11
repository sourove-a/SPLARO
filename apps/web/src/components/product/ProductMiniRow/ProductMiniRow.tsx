'use client'

import Image from 'next/image'
import type { ProductDetailItem } from '@/components/product/ProductDetailPanel/ProductDetailPanel'
import { HorizontalScrollRail } from '@/components/ui/HorizontalScrollRail'
import { formatBDT } from '@/lib/utils/currency'

interface ProductMiniRowProps {
  title: string
  products: ProductDetailItem[]
  onSelect: (product: ProductDetailItem) => void
}

export function ProductMiniRow({ title, products, onSelect }: ProductMiniRowProps) {
  if (products.length === 0) return null

  return (
    <section className="product-mini-row">
      <h3 className="product-mini-row__title">{title}</h3>
      <HorizontalScrollRail
        className="product-mini-row__rail"
        trackClassName="product-mini-row__scroll"
        ariaLabel={title}
      >
        {products.map((item) => (
          <button
            key={item.id}
            type="button"
            className="product-mini-card"
            onClick={() => onSelect(item)}
          >
            <div className="product-mini-card__media">
              <Image
                src={item.image}
                alt={item.name}
                fill
                sizes="120px"
                className="object-contain object-center"
              />
            </div>
            <div className="product-mini-card__body">
              <p className="product-mini-card__name">{item.name}</p>
              <p className="product-mini-card__price">{formatBDT(item.price)}</p>
            </div>
          </button>
        ))}
      </HorizontalScrollRail>
    </section>
  )
}
