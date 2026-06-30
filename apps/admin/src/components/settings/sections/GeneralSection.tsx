import { Building2 } from 'lucide-react'
import { SectionCard, SectionPageHeader, FieldGrid, Field, SaveBar, type SectionProps } from './shared'

const CURRENCIES = ['BDT', 'USD', 'EUR', 'GBP', 'AED', 'SAR']
const TIMEZONES = ['Asia/Dhaka', 'Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'UTC']

export function GeneralSection({ draft, setDraft, save, saving, apiOnline }: SectionProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionPageHeader
        icon={<Building2 size={22} />}
        title="General"
        subtitle="Core store identity — name, contact, currency, and timezone."
        badge="Store"
      />
      <SectionCard title="Store information" subtitle="Basic identity shown across admin and storefront.">
        <FieldGrid>
          <Field label="Store name" span2>
            <input
              className="settings-input"
              value={draft.store.name}
              onChange={(e) => setDraft((p) => ({ ...p, store: { ...p.store, name: e.target.value } }))}
            />
          </Field>
          <Field label="Store email">
            <input
              className="settings-input"
              type="email"
              value={draft.store.email}
              onChange={(e) => setDraft((p) => ({ ...p, store: { ...p.store, email: e.target.value }, contact: { ...p.contact, email: e.target.value } }))}
            />
          </Field>
          <Field label="Store phone">
            <input
              className="settings-input"
              value={draft.store.phone}
              onChange={(e) => setDraft((p) => ({ ...p, store: { ...p.store, phone: e.target.value }, contact: { ...p.contact, phone: e.target.value } }))}
            />
          </Field>
          <Field label="Short description" span2>
            <textarea
              className="settings-input min-h-[80px] resize-none"
              value={draft.store.description}
              onChange={(e) => setDraft((p) => ({ ...p, store: { ...p.store, description: e.target.value } }))}
            />
          </Field>
        </FieldGrid>
        <SaveBar label="Save store info" saving={saving} disabled={!apiOnline} onClick={() => save({ store: draft.store, contact: draft.contact }, 'Store info')} />
      </SectionCard>

      <SectionCard title="Region & currency" subtitle="Used for price formatting and order dates.">
        <FieldGrid>
          <Field label="Currency">
            <select
              className="settings-input"
              value={draft.store.currency}
              onChange={(e) => setDraft((p) => ({ ...p, store: { ...p.store, currency: e.target.value } }))}
            >
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Timezone">
            <select
              className="settings-input"
              value={draft.store.timezone}
              onChange={(e) => setDraft((p) => ({ ...p, store: { ...p.store, timezone: e.target.value } }))}
            >
              {TIMEZONES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </FieldGrid>
        <SaveBar label="Save region" saving={saving} disabled={!apiOnline} onClick={() => save({ store: draft.store }, 'Region settings')} />
      </SectionCard>
    </div>
  )
}
