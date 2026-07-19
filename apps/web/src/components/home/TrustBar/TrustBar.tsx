import { ShieldCheck, Truck, RotateCcw, Zap } from 'lucide-react'

const items = [
  { icon: ShieldCheck, text: '100% Authentic Product', short: 'Authentic' },
  { icon: Truck, text: 'Cash On Delivery', short: 'COD' },
  { icon: RotateCcw, text: 'Easy Returns', short: 'Returns' },
  { icon: Zap, text: 'Fast Delivery', short: 'Fast Delivery' },
]

export function TrustBar() {
  return (
    <section className="trust-bar" aria-label="Delivery and trust assurances">
      <div className="container-luxury trust-bar__container">
        <div className="trust-bar__panel">
          <div className="trust-bar__accent" aria-hidden />
          <div className="trust-bar__shine" aria-hidden />
          <ul className="trust-bar__grid">
            {items.map(({ icon: Icon, text, short }) => (
              <li key={text} className="trust-bar__cell">
                <span className="trust-bar__icon">
                  <Icon className="trust-bar__icon-svg" strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="trust-bar__label trust-bar__label--full">{text}</span>
                <span className="trust-bar__label trust-bar__label--short" aria-hidden="true">{short}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
