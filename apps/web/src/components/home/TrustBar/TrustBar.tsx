import Link from 'next/link'
import { ShieldCheck, Truck, RotateCcw, Zap } from 'lucide-react'
import { PremiumIcon } from '@/components/ui/PremiumIcon'

/**
 * The strip used to be icon-only, with the promise living in `title` — which
 * is a hover tooltip, and phones do not hover. A shield, a lightning bolt and
 * a rotating arrow tell a first-time shopper nothing, and these four lines are
 * exactly the reassurance a COD customer wants before trusting a new store.
 *
 * `label` is the visible form on touch widths and is deliberately one short
 * word or two: four cells share a ~21rem pill, so anything longer wraps to
 * three lines and the strip stops looking quiet. `text` keeps the full
 * sentence for screen readers and the desktop tooltip.
 */
const items = [
  {
    icon: ShieldCheck,
    label: 'Checked',
    text: 'Quality checked before dispatch',
    href: '/about',
  },
  {
    icon: Truck,
    label: 'COD',
    text: 'Cash on delivery nationwide',
    href: '/payment-policy',
  },
  {
    icon: RotateCcw,
    label: '7-day return',
    text: '7-day easy returns',
    href: '/returns',
  },
  {
    icon: Zap,
    label: 'Fast courier',
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
            {items.map(({ icon, label, text, href }) => (
              <li key={href} className="trust-bar__cell">
                <Link href={href} className="trust-bar__link" aria-label={text} title={text}>
                  <span className="trust-bar__icon" aria-hidden>
                    <PremiumIcon icon={icon} size="md" className="trust-bar__premium-icon" />
                  </span>
                  <span className="trust-bar__label" aria-hidden>
                    {label}
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
