import Link from 'next/link'
import { BagIcon } from '@/components/product/AddToBagIcon'
import { ArrowRight, Sparkles } from 'lucide-react'

interface CartEmptyStateProps {
  onClose?: () => void
}

const QUICK_CATEGORY_LINKS = [
  { label: 'New Arrivals', href: '/new-arrivals' },
  { label: 'Best Sellers', href: '/best-sellers' },
  { label: 'Footwear', href: '/footwear' },
  { label: 'Accessories', href: '/accessories' },
]

export function CartEmptyState({ onClose }: CartEmptyStateProps) {
  return (
    <div className="cart-empty-state flex min-h-[360px] h-full flex-col items-center justify-center gap-5 px-6 py-10 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-stone-100/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_10px_25px_-5px_rgba(0,0,0,0.05)] border border-stone-200/50">
        <BagIcon size={32} strokeWidth={1.25} className="text-stone-700" />
        <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
          <Sparkles size={12} />
        </div>
      </div>

      <div className="max-w-xs space-y-1.5">
        <h3 className="text-base font-semibold tracking-tight text-stone-900">Your bag is currently empty</h3>
        <p className="text-xs text-stone-500 leading-relaxed">
          Discover quiet luxury pieces curated for your wardrobe across Bangladesh.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full max-w-xs mt-1">
        <Link
          href="/shop"
          {...(onClose ? { onClick: onClose } : {})}
          className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 active:scale-[0.98] rounded-full shadow-sm transition-all duration-200"
        >
          <span>Shop Now</span>
          <ArrowRight size={14} />
        </Link>
        
        <Link
          href="/new-arrivals"
          {...(onClose ? { onClick: onClose } : {})}
          className="inline-flex items-center justify-center gap-1.5 w-full px-5 py-3 text-xs font-medium text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200/80 active:scale-[0.98] rounded-full border border-stone-200/60 transition-all duration-200"
        >
          <span>New Arrivals</span>
        </Link>
      </div>

      <div className="pt-3 border-t border-stone-200/60 w-full max-w-xs">
        <p className="text-[0.68rem] font-medium tracking-wide uppercase text-stone-400 mb-2.5">
          Popular Departments
        </p>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {QUICK_CATEGORY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              {...(onClose ? { onClick: onClose } : {})}
              className="inline-block px-3 py-1.5 text-[0.72rem] font-medium text-stone-600 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-200/80 rounded-full transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
