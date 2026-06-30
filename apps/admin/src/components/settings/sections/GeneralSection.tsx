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

      <SectionCard
        title="Catalog & SKU policy"
        subtitle="Live launch: type your own SKU codes. Auto-generate stays off unless you enable it."
      >
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/8 bg-white/50 p-3 dark:border-white/10 dark:bg-white/5">
          <input
            type="checkbox"
            checked={draft.catalog.autoGenerateSku}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                catalog: { ...p.catalog, autoGenerateSku: e.target.checked },
              }))
            }
            className="mt-1"
          />
          <div>
            <p className="text-sm font-bold text-[var(--admin-text-primary)]">Auto-generate SKUs</p>
            <p className="mt-1 text-xs font-medium text-[var(--admin-text-muted)]">
              Off (recommended): you write SKU on each variant in product edit. On: admin can bulk-fill empty variant SKUs.
            </p>
          </div>
        </label>
        <SaveBar
          label="Save catalog policy"
          saving={saving}
          disabled={!apiOnline}
          onClick={() => save({ catalog: draft.catalog }, 'Catalog policy')}
        />
      </SectionCard>
    </div>
  )
}
