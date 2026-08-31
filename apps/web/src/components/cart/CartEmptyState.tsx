import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
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
        <div className="cart-empty-state__icon-wrap">
          <BagIcon size={28} strokeWidth={1.4} />
        </div>
      </div>

      <div className="cart-empty-state__copy">
        <p className="cart-empty-state__kicker">Shopping Bag · 0 Items</p>
        <h2 id="empty-bag-title" className="cart-empty-state__title">
          Your bag is empty
        </h2>
        <p className="cart-empty-state__description">
          Explore signature clothing, handcrafted footwear, and refined accessories tailored for you.
        </p>
      </div>

      <div className="cart-empty-state__actions">
        <Link href="/shop" {...closeProps} className="cart-empty-state__primary">
          <span>Explore Collection</span>
          <ArrowRight size={15} strokeWidth={2} className="cart-empty-state__btn-arrow" aria-hidden />
        </Link>
        <Link href="/new-arrivals" {...closeProps} className="cart-empty-state__secondary">
          <Sparkles size={13} strokeWidth={1.8} aria-hidden />
          <span>View New Arrivals</span>
        </Link>
      </div>

      <nav className="cart-empty-state__departments" aria-label="Shop by department">
        <p className="cart-empty-state__department-label">Shop by Category</p>
        <div className="cart-empty-state__department-grid">
          {DEPARTMENT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              {...closeProps}
              className="cart-empty-state__department"
            >
              <span className="cart-empty-state__dept-name">{link.label}</span>
              <ArrowRight size={13} strokeWidth={1.8} className="cart-empty-state__dept-arrow" aria-hidden />
            </Link>
          ))}
        </div>
      </nav>
    </section>
  )
}
