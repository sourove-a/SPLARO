import Link from 'next/link'
import { BagIcon } from '@/components/product/AddToBagIcon'

interface CartEmptyStateProps {
  onClose?: () => void
}

export function CartEmptyState({ onClose }: CartEmptyStateProps) {
  return (
    <div className="cart-empty-state flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <BagIcon size={28} strokeWidth={1.2} className="text-luxury-gray" />
      </div>
      <div>
        <p className="text-sm font-medium text-luxury-black">Your bag is empty</p>
        <p className="mt-1 text-[0.75rem] text-luxury-gray">Discover the latest SPLARO products</p>
      </div>
      <Link
        href="/shop"
        {...(onClose ? { onClick: onClose } : {})}
        className="btn-luxury mt-2 text-[0.625rem]"
      >
        Explore Products
      </Link>
    </div>
  )
}
