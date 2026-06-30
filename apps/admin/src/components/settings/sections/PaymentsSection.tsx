import { CreditCard } from 'lucide-react'
import { SectionCard, SectionPageHeader, Toggle, SaveBar, type SectionProps } from './shared'

export function PaymentsSection({ draft, setDraft, save, saving, apiOnline }: SectionProps) {
  const toggle = (key: keyof typeof draft.payments) =>
    setDraft((p) => ({ ...p, payments: { ...p.payments, [key]: !p.payments[key] } }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionPageHeader
        icon={<CreditCard size={22} />}
        title="Payments"
        subtitle="Enable or disable payment methods available at checkout."
        badge="Checkout"
      />
      <SectionCard title="Payment methods" subtitle="Enable or disable payment options at checkout.">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <Toggle
            label="Cash on delivery (COD)"
            desc="Customer pays when order arrives. Zero integration needed."
            checked={draft.payments.cod}
            onChange={() => toggle('cod')}
          />
          <Toggle
            label="bKash"
            desc="Mobile banking — most popular in Bangladesh."
            checked={draft.payments.bkash}
            onChange={() => toggle('bkash')}
          />
          <Toggle
            label="Nagad"
            desc="Postal mobile banking — widely used alternative."
            checked={draft.payments.nagad ?? false}
            onChange={() => toggle('nagad')}
          />
          <Toggle
            label="SSLCommerz"
            desc="Card payments, net banking, and additional MFS channels."
            checked={draft.payments.sslcommerz}
            onChange={() => toggle('sslcommerz')}
          />
        </div>
        <SaveBar label="Save payments" saving={saving} disabled={!apiOnline} onClick={() => save({ payments: draft.payments }, 'Payments')} />
      </SectionCard>
    </div>
  )
}
