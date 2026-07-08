import Link from 'next/link'
import { ShoppingBag } from 'lucide-react'

interface CartEmptyStateProps {
  onClose?: () => void
}

export function CartEmptyState({ onClose }: CartEmptyStateProps) {
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
    </div>
  )
}
