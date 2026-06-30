import { Truck } from 'lucide-react'
import { SectionCard, SectionPageHeader, FieldGrid, Field, Toggle, SaveBar, type SectionProps } from './shared'

export function ShippingSection({ draft, setDraft, save, saving, apiOnline }: SectionProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionPageHeader
        icon={<Truck size={22} />}
        title="Shipping"
        subtitle="Delivery zones, charges, and free shipping threshold."
        badge="Logistics"
      />
      <SectionCard title="Delivery options" subtitle="Control which shipping zones are available at checkout.">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <Toggle
            label="Dhaka same-day / express"
            desc="Offer same-day delivery within Dhaka city."
            checked={draft.shipping.dhakaSameDay}
            onChange={() => setDraft((p) => ({ ...p, shipping: { ...p.shipping, dhakaSameDay: !p.shipping.dhakaSameDay } }))}
          />
          <Toggle
            label="Outside Dhaka delivery"
            desc="Courier delivery to the rest of Bangladesh."
            checked={draft.shipping.outsideDhaka}
            onChange={() => setDraft((p) => ({ ...p, shipping: { ...p.shipping, outsideDhaka: !p.shipping.outsideDhaka } }))}
          />
        </div>
      </SectionCard>

      <SectionCard title="Delivery charges" subtitle="Customers pay these rates unless free shipping threshold is met.">
        <FieldGrid>
          <Field label="Dhaka delivery charge (৳)">
            <input
              className="settings-input"
              type="number"
              min={0}
              value={draft.shipping.dhakaDeliveryCharge}
              onChange={(e) => setDraft((p) => ({ ...p, shipping: { ...p.shipping, dhakaDeliveryCharge: Number(e.target.value) } }))}
            />
          </Field>
          <Field label="Outside Dhaka charge (৳)">
            <input
              className="settings-input"
              type="number"
              min={0}
              value={draft.shipping.outsideDhakaCharge}
              onChange={(e) => setDraft((p) => ({ ...p, shipping: { ...p.shipping, outsideDhakaCharge: Number(e.target.value) } }))}
            />
          </Field>
          <Field label="Free shipping on orders above (৳)">
            <input
              className="settings-input"
              type="number"
              min={0}
              placeholder="0 = disabled"
              value={draft.shipping.freeShippingMin}
              onChange={(e) => setDraft((p) => ({ ...p, shipping: { ...p.shipping, freeShippingMin: e.target.value } }))}
            />
          </Field>
        </FieldGrid>
        <SaveBar label="Save shipping" saving={saving} disabled={!apiOnline} onClick={() => save({ shipping: draft.shipping }, 'Shipping')} />
      </SectionCard>
    </div>
  )
}
