import { Wifi } from 'lucide-react'
import { SectionCard, SectionPageHeader, FieldGrid, Field, SaveBar, type SectionProps } from './shared'

export function DomainSection({ draft, setDraft, save, saving, apiOnline }: SectionProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionPageHeader
        icon={<Wifi size={22} />}
        title="Domain & SEO"
        subtitle="Primary domain, canonical URL, and default meta tags."
        badge="SEO"
      />
      <SectionCard title="Domain & URL" subtitle="Controls canonical URL used in OG tags, sitemaps, and emails.">
        <FieldGrid cols={1}>
          <Field label="Primary domain">
            <input
              className="settings-input"
              placeholder="splaro.com"
              value={draft.store.domain}
              onChange={(e) => setDraft((p) => ({ ...p, store: { ...p.store, domain: e.target.value } }))}
            />
          </Field>
        </FieldGrid>
        <p style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "var(--admin-text-muted)" }}>
          Enter domain without <code className="text-[#5E7CFF]">https://</code>. Used for sitemap and canonical links.
        </p>
        <SaveBar label="Save domain" saving={saving} disabled={!apiOnline} onClick={() => save({ store: draft.store }, 'Domain')} />
      </SectionCard>

      <SectionCard title="SEO defaults" subtitle="Fallback meta title/description when pages don't set their own.">
        <FieldGrid cols={1}>
          <Field label="Default meta title">
            <input
              className="settings-input"
              placeholder="SPLARO — Crafted for those who dare to be different"
              value={draft.store.name}
              onChange={(e) => setDraft((p) => ({ ...p, store: { ...p.store, name: e.target.value } }))}
            />
          </Field>
          <Field label="Default meta description">
            <textarea
              className="settings-input min-h-[80px] resize-none"
              placeholder="Premium streetwear brand from Bangladesh."
              value={draft.store.description}
              onChange={(e) => setDraft((p) => ({ ...p, store: { ...p.store, description: e.target.value } }))}
            />
          </Field>
        </FieldGrid>
        <SaveBar label="Save SEO defaults" saving={saving} disabled={!apiOnline} onClick={() => save({ store: draft.store }, 'SEO defaults')} />
      </SectionCard>
    </div>
  )
}
