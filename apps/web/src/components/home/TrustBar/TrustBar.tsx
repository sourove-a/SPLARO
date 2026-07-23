'use client'

import Link from 'next/link'
import { ShieldCheck, Truck, RotateCcw, Zap } from 'lucide-react'
import { PremiumIcon } from '@/components/ui/PremiumIcon'

const items = [
  {
    icon: ShieldCheck,
    text: '100% authentic — every piece',
    short: 'Authentic',
    href: '/about',
  },
  {
    icon: Truck,
    text: 'Cash on delivery nationwide',
    short: 'COD',
    href: '/payment-policy',
  },
  {
    icon: RotateCcw,
    text: '7-day easy returns',
    short: 'Returns',
    href: '/returns',
  },
  {
    icon: Zap,
    text: 'Fast courier · Dhaka 1–2 days',
    short: 'Fast ship',
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
            {items.map(({ icon, text, short, href }) => (
              <li key={href} className="trust-bar__cell">
                <Link href={href} className="trust-bar__link">
                  <span className="trust-bar__icon">
                    <PremiumIcon icon={icon} size="md" className="trust-bar__premium-icon" />
                  </span>
                  <span className="trust-bar__label trust-bar__label--full">{text}</span>
                  <span className="trust-bar__label trust-bar__label--short" aria-hidden="true">
                    {short}
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
