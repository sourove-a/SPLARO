import { RotateCcw, ShieldCheck, Truck } from 'lucide-react'

const signals = [
  { icon: ShieldCheck, label: 'Authentic' },
  { icon: Truck, label: 'Fast COD' },
  { icon: RotateCcw, label: 'Easy Returns' },
] as const

export function CartTrustSignals() {
  return (
    <ul className="cart-trust" aria-label="Purchase assurances">
      {signals.map(({ icon: Icon, label }) => (
        <li key={label} className="cart-trust__item">
          <Icon className="cart-trust__icon" strokeWidth={1.5} aria-hidden />
          <span className="cart-trust__label">{label}</span>
        </li>
      ))}
    </ul>
  )
}
