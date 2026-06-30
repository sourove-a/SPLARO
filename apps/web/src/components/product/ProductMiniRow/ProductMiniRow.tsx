'use client'

import Image from 'next/image'
import type { ProductDetailItem } from '@/components/product/ProductDetailPanel/ProductDetailPanel'
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
      <div className="product-mini-row__scroll" data-lenis-prevent>
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
                className="object-cover object-top"
              />
            </div>
            <div className="product-mini-card__body">
              <p className="product-mini-card__name">{item.name}</p>
              <p className="product-mini-card__price">{formatBDT(item.price)}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
