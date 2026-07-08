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
    <div className="px-6 py-4">
      <div className="flex gap-4">
        <div className="h-20 w-16 shrink-0 overflow-hidden rounded-2xl bg-white/70 shadow-[0_10px_24px_rgba(20,24,32,0.08)]">
          {item.image ? (
            <Image
              src={item.image}
              alt={item.name}
              width={64}
              height={80}
              className="h-full w-full object-contain object-center"
            />
          ) : (
            <div className="h-full w-full bg-ivory-300" />
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between">
          <div>
            <p className="line-clamp-2 text-[0.75rem] font-black uppercase tracking-[0.08em] text-luxury-black">
              {item.name}
            </p>
            {(item.size || item.color) && (
              <p className="mt-0.5 text-[0.625rem] text-luxury-gray">
                {[item.size, item.color].filter(Boolean).join(' · ')}
              </p>
            )}
            <p className="mt-1 text-[0.75rem] font-medium text-luxury-black">
              {item.price > 0 ? formatBDT(item.price) : '-'}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 rounded-full border border-white/70 bg-white/65 px-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <button
                type="button"
                onClick={onDecrease}
                disabled={item.quantity <= 1}
                aria-label="Decrease quantity"
                className={cn(
                  'flex h-7 w-7 items-center justify-center text-luxury-gray transition-colors hover:text-luxury-black',
                  item.quantity <= 1 && 'cursor-not-allowed opacity-35 hover:text-luxury-gray',
                )}
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="min-w-[1.25rem] text-center text-[0.75rem] font-medium">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={onIncrease}
                aria-label="Increase quantity"
                className="flex h-7 w-7 items-center justify-center text-luxury-gray transition-colors hover:text-luxury-black"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>

            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove item"
              className="text-luxury-gray/50 transition-colors hover:text-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
