import { Truck } from 'lucide-react'
import { SectionCard, SectionPageHeader, FieldGrid, Field, Toggle, SaveBar, type SectionProps } from './shared'
import type { AdminSettingsData } from '@/lib/api/settings'

export function ShippingSection({ draft, setDraft, save, saving, apiOnline }: SectionProps) {
  const persistShipping = (next: AdminSettingsData['shipping'], label: string) => {
    setDraft((p) => ({ ...p, shipping: next }))
    save({ shipping: next }, label)
  }

  const toggleZone = (key: 'dhakaSameDay' | 'outsideDhaka') => {
    const next = { ...draft.shipping, [key]: !draft.shipping[key] }
    const label =
      key === 'dhakaSameDay'
        ? next.dhakaSameDay
          ? 'Dhaka delivery enabled'
          : 'Dhaka delivery disabled'
        : next.outsideDhaka
          ? 'Outside Dhaka enabled'
          : 'Outside Dhaka disabled'
    persistShipping(next, label)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionPageHeader
        icon={<Truck size={22} />}
        title="Shipping"
        subtitle="Delivery zones, charges, and free shipping threshold — toggles save immediately."
        badge="Logistics"
      />
      <SectionCard
        title="Delivery options"
        subtitle="Control which shipping zones are available at checkout. Each switch saves to the server right away."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Toggle
            label="Dhaka same-day / express"
            desc="Offer same-day delivery within Dhaka city. Customers see this at checkout."
            checked={Boolean(draft.shipping.dhakaSameDay)}
            disabled={saving || !apiOnline}
            onChange={() => toggleZone('dhakaSameDay')}
          />
          <Toggle
            label="Outside Dhaka delivery"
            desc="Courier delivery to the rest of Bangladesh (Steadfast / nationwide)."
            checked={Boolean(draft.shipping.outsideDhaka)}
            disabled={saving || !apiOnline}
            onChange={() => toggleZone('outsideDhaka')}
          />
        </div>
        {!draft.shipping.dhakaSameDay && !draft.shipping.outsideDhaka ? (
          <p
            style={{
              marginTop: '0.85rem',
              padding: '0.65rem 0.85rem',
              borderRadius: 12,
              border: '1px solid rgba(245, 158, 11, 0.35)',
              background: 'rgba(245, 158, 11, 0.1)',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#92400e',
            }}
          >
            Both zones are off — checkout cannot offer delivery. Turn at least one zone on.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard title="Delivery charges" subtitle="Customers pay these rates unless free shipping threshold is met.">
        <FieldGrid>
          <Field label="Dhaka delivery charge (৳)" hint="Charged when the customer chooses a Dhaka delivery zone.">
            <input
              className="settings-input"
              type="number"
              min={0}
              value={draft.shipping.dhakaDeliveryCharge}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  shipping: { ...p.shipping, dhakaDeliveryCharge: Number(e.target.value) },
                }))
              }
            />
          </Field>
          <Field label="Outside Dhaka charge (৳)" hint="Charged for all districts outside Dhaka.">
            <input
              className="settings-input"
              type="number"
              min={0}
              value={draft.shipping.outsideDhakaCharge}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  shipping: { ...p.shipping, outsideDhakaCharge: Number(e.target.value) },
                }))
              }
            />
          </Field>
          <Field
            label="Free shipping on orders above (৳)"
            hint="Set 0 to disable free shipping. Example: 5000 = free delivery above ৳5,000."
          >
            <input
              className="settings-input"
              type="number"
              min={0}
              placeholder="0 = disabled"
              value={draft.shipping.freeShippingMin}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  shipping: { ...p.shipping, freeShippingMin: e.target.value },
                }))
              }
            />
          </Field>
        </FieldGrid>
        <SaveBar
          label="Save shipping charges"
          saving={saving}
          disabled={!apiOnline}
          onClick={() => save({ shipping: draft.shipping }, 'Shipping charges')}
        />
      </SectionCard>
    </div>
  )
}
