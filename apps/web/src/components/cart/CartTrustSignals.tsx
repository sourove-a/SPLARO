import { RotateCcw, ShieldCheck, Truck } from 'lucide-react'

const signals = [
  { icon: ShieldCheck, label: 'Authentic' },
  { icon: Truck, label: 'Fast COD' },
  { icon: RotateCcw, label: 'Easy Returns' },
] as const

export function CartTrustSignals() {
  return (
    <div className="mb-5 flex items-center justify-between rounded-2xl border border-white/70 bg-white/65 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      {signals.map(({ icon: Icon, label }) => (
        <div key={label} className="flex flex-col items-center gap-1">
          <Icon className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
          <span className="text-[0.45rem] font-semibold uppercase tracking-[0.15em] text-luxury-gray">
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}
