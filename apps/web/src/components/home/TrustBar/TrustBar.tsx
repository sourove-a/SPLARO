import Link from 'next/link'
import { ShieldCheck, Truck, RotateCcw, Zap } from 'lucide-react'
import { PremiumIcon } from '@/components/ui/PremiumIcon'

/** Icon-only strip — text lives in aria-label/title for a11y + hover tooltip. */
const items = [
  {
    icon: ShieldCheck,
    text: '100% authentic — every piece',
    href: '/about',
  },
  {
    icon: Truck,
    text: 'Cash on delivery nationwide',
    href: '/payment-policy',
  },
  {
    icon: RotateCcw,
    text: '7-day easy returns',
    href: '/returns',
  },
  {
    icon: Zap,
    text: 'Fast courier · Dhaka 1–2 days',
    href: '/shipping',
  },
] as const

export function TrustBar() {
  return (
    <section className="trust-bar" aria-label="Delivery and trust assurances">
      <div className="container-luxury trust-bar__container">
        <div className="trust-bar__panel">
          <div className="trust-bar__accent" aria-hidden />
          <div className="trust-bar__shine" aria-hidden />
          <ul className="trust-bar__grid">
            {items.map(({ icon, text, href }) => (
              <li key={href} className="trust-bar__cell">
                <Link href={href} className="trust-bar__link" aria-label={text} title={text}>
                  <span className="trust-bar__icon" aria-hidden>
                    <PremiumIcon icon={icon} size="md" className="trust-bar__premium-icon" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
