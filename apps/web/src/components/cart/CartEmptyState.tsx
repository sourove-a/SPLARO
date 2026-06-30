import Link from 'next/link'
import Image from 'next/image'
import { ShoppingBag } from 'lucide-react'
import { getAllProducts } from '@/lib/catalog'
import { formatBDT } from '@/lib/utils/currency'

interface CartEmptyStateProps {
  onClose?: () => void
}

export function CartEmptyState({ onClose }: CartEmptyStateProps) {
  const suggestions = getAllProducts().slice(0, 3)

  return (
    <div className="cart-empty-state flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <ShoppingBag className="h-7 w-7 text-luxury-gray" strokeWidth={1} />
      </div>
      <div>
        <p className="text-sm font-medium text-luxury-black">Your bag is empty</p>
        <p className="mt-1 text-[0.75rem] text-luxury-gray">Discover the latest SPLARO products</p>
      </div>
      <Link
        href="/collections"
        {...(onClose ? { onClick: onClose } : {})}
        className="btn-luxury mt-2 text-[0.625rem]"
      >
        Explore Products
      </Link>

      {suggestions.length > 0 ? (
        <div className="cart-empty-state__suggestions" aria-label="Recommended products">
          <p className="cart-empty-state__eyebrow">Recommended</p>
          <div className="cart-empty-state__grid">
            {suggestions.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.slug}`}
                {...(onClose ? { onClick: onClose } : {})}
                className="cart-empty-state__item"
              >
                <span className="cart-empty-state__image">
                  <Image
                    src={product.images[0] ?? ''}
                    alt={product.name}
                    fill
                    sizes="72px"
                    className="object-cover"
                  />
                </span>
                <span className="cart-empty-state__meta">
                  <span className="cart-empty-state__name">{product.name}</span>
                  <span className="cart-empty-state__price">{formatBDT(product.price)}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
