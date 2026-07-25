import { Wifi } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { SectionCard, SectionPageHeader, FieldGrid, Field, SaveBar, type SectionProps } from './shared'

const DEFAULT_DESCRIPTION = 'Premium streetwear brand from Bangladesh.'

export function DomainSection({ draft, setDraft, save, saving, apiOnline }: SectionProps) {
  const descriptionEmpty = !draft.store.description?.trim()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionPageHeader
        icon={<Wifi size={22} />}
        title="Domain & store identity"
        subtitle="Primary domain, store name, and public description used across the site."
        badge="STORE"
      />
      <SectionCard title="Domain & URL" subtitle="Controls canonical URL used in OG tags, sitemaps, and emails.">
        <FieldGrid cols={1}>
          <Field
            label="Primary domain"
            hint="Enter domain without https://. Used for sitemap, canonical links, and invoice footers."
          >
            <input
              className="settings-input"
              placeholder="splaro.co"
              value={draft.store.domain}
              onChange={(e) => setDraft((p) => ({ ...p, store: { ...p.store, domain: e.target.value } }))}
            />
          </Field>
        </FieldGrid>
        <SaveBar
          label="Save domain"
          saving={saving}
          disabled={!apiOnline}
          onClick={() => save({ store: draft.store }, 'Domain')}
        />
      </SectionCard>

      <SectionCard
        title="Store name & description"
        subtitle="These fields update the store record (same as General → Short description). Product-level meta titles stay on each product."
      >
        <FieldGrid cols={1}>
          <Field label="Store name" hint="Brand name customers see in titles, emails, and invoices.">
            <input
              className="settings-input"
              placeholder="SPLARO"
              value={draft.store.name}
              onChange={(e) => setDraft((p) => ({ ...p, store: { ...p.store, name: e.target.value } }))}
            />
          </Field>
          <Field
            label="Store description"
            hint="Public brand blurb. Leave blank only if you intentionally want no description."
          >
            <textarea
              className="settings-input min-h-[80px] resize-none"
              placeholder={DEFAULT_DESCRIPTION}
              value={draft.store.description}
              onChange={(e) => setDraft((p) => ({ ...p, store: { ...p.store, description: e.target.value } }))}
            />
            {descriptionEmpty ? (
              <div style={{ marginTop: '0.55rem' }}>
                <AdminButton
                  size="sm"
                  variant="ghost"
                  disabled={!apiOnline || saving}
                  onClick={() => {
                    const store = { ...draft.store, description: DEFAULT_DESCRIPTION }
                    setDraft((p) => ({ ...p, store }))
                    save({ store }, 'Store identity')
                  }}
                >
                  Fill recommended description
                </AdminButton>
              </div>
            ) : null}
          </Field>
        </FieldGrid>
        <SaveBar
          label="Save store identity"
          saving={saving}
          disabled={!apiOnline}
          onClick={() => save({ store: draft.store }, 'Store identity')}
        />
      </SectionCard>
    </div>
  )
}
