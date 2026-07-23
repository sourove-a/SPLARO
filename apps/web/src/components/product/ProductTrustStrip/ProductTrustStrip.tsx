import Link from 'next/link'
import { ShieldCheck, Truck, RotateCcw, Banknote } from 'lucide-react'
import { PremiumIcon } from '@/components/ui/PremiumIcon'
import { cn } from '@/lib/utils/cn'

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    label: '100% authentic',
    href: '/about',
    title: 'Genuine SPLARO products — authenticity guaranteed',
  },
  {
    icon: Banknote,
    label: 'Cash on delivery',
    href: '/payment-policy',
    title: 'Pay the courier when your order arrives',
  },
  {
    icon: RotateCcw,
    label: '7-day easy returns',
    href: '/returns',
    title: 'Unworn items with tags — return within 7 days',
  },
  {
    icon: Truck,
    label: 'Nationwide delivery',
    href: '/shipping',
    title: 'Dhaka 1–2 days · Outside 2–4 business days',
  },
] as const

type ProductTrustStripProps = {
  className?: string
  /** denser chips under PDP CTAs */
  compact?: boolean
}

/** Shared trust / authenticity strip — PDP purchase panel + reuse elsewhere. */
export function ProductTrustStrip({ className, compact = false }: ProductTrustStripProps) {
  return (
    <ul
      className={cn('pdp-trust', compact && 'pdp-trust--compact', className)}
      aria-label="Shopping assurances"
    >
      {TRUST_ITEMS.map(({ icon, label, href, title }) => (
        <li key={href}>
          <Link href={href} className="pdp-trust__chip" title={title}>
            <PremiumIcon icon={icon} size={compact ? 'xs' : 'sm'} />
            <span>{label}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
