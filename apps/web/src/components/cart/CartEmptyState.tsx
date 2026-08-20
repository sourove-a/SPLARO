import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { BagIcon } from '@/components/product/AddToBagIcon'

interface CartEmptyStateProps {
  onClose?: () => void
}

const DEPARTMENT_LINKS = [
  { label: 'Men', href: '/collections/men' },
  { label: 'Women', href: '/collections/women' },
  { label: 'Footwear', href: '/collections/footwear' },
  { label: 'Accessories', href: '/accessories' },
]

export function CartEmptyState({ onClose }: CartEmptyStateProps) {
  const closeProps = onClose ? { onClick: onClose } : {}

  return (
    <section className="cart-empty-state" aria-labelledby="empty-bag-title">
      <div className="cart-empty-state__seal" aria-hidden>
        <span className="cart-empty-state__seal-line" />
        <BagIcon size={34} strokeWidth={1.15} />
        <span className="cart-empty-state__zero">0</span>
      </div>

      <div className="cart-empty-state__copy">
        <p className="cart-empty-state__kicker">Your edit · 0 pieces</p>
        <h2 id="empty-bag-title" className="cart-empty-state__title">
          Your bag is waiting.
        </h2>
        <p className="cart-empty-state__description">
          Start with considered pieces made for everyday Bangladesh.
        </p>
      </div>

      <div className="cart-empty-state__actions">
        <Link href="/shop" {...closeProps} className="cart-empty-state__primary">
          Explore collection
          <ArrowRight size={15} strokeWidth={1.7} aria-hidden />
        </Link>
        <Link href="/new-arrivals" {...closeProps} className="cart-empty-state__secondary">
          View new arrivals
          <ArrowRight size={13} strokeWidth={1.7} aria-hidden />
        </Link>
      </div>

      <nav className="cart-empty-state__departments" aria-label="Shop by department">
        <p className="cart-empty-state__department-label">Shop by department</p>
        <div className="cart-empty-state__department-grid">
          {DEPARTMENT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              {...closeProps}
              className="cart-empty-state__department"
            >
              <span>{link.label}</span>
              <ArrowRight size={12} strokeWidth={1.6} aria-hidden />
            </Link>
          ))}
        </div>
      </nav>
    </section>
  )
}
