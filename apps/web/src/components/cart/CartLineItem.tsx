import Image from 'next/image'
import { Minus, Plus, Trash2 } from 'lucide-react'
import type { CartItem } from '@/store/cartStore'
import { formatBDT } from '@/lib/utils/currency'
import { cn } from '@/lib/utils/cn'

interface CartLineItemProps {
  item: CartItem
  onDecrease: () => void
  onIncrease: () => void
  onRemove: () => void
}

export function CartLineItem({ item, onDecrease, onIncrease, onRemove }: CartLineItemProps) {
  return (
    <div className="cart-line">
      <div className="cart-line__media">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name}
            width={72}
            height={90}
            className="cart-line__img"
          />
        ) : (
          <div className="cart-line__img cart-line__img--empty" aria-hidden />
        )}
      </div>

      <div className="cart-line__meta">
        <div className="cart-line__copy">
          <p className="cart-line__name">{item.name}</p>
          {item.size || item.color ? (
            <p className="cart-line__variant">
              {[item.size, item.color].filter(Boolean).join(' · ')}
            </p>
          ) : null}
          <p className="cart-line__price">
            {item.price > 0 ? formatBDT(item.price) : '-'}
          </p>
        </div>

        <div className="cart-line__actions">
          <div className="cart-line__qty" role="group" aria-label="Quantity">
            <button
              type="button"
              onClick={onDecrease}
              disabled={item.quantity <= 1}
              aria-label="Decrease quantity"
              className={cn('cart-line__qty-btn', item.quantity <= 1 && 'is-disabled')}
            >
              <Minus strokeWidth={1.75} aria-hidden />
            </button>
            <span className="cart-line__qty-value">{item.quantity}</span>
            <button
              type="button"
              onClick={onIncrease}
              aria-label="Increase quantity"
              className="cart-line__qty-btn"
            >
              <Plus strokeWidth={1.75} aria-hidden />
            </button>
          </div>

          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove item"
            className="cart-line__remove"
          >
            <Trash2 strokeWidth={1.6} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}
