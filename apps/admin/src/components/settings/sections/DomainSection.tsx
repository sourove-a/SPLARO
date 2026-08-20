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
        subtitle="Primary domain, store identity, and default meta tags for pages without their own SEO."
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

      <SectionCard
        title="Default meta tags"
        subtitle="Used on pages that do not set their own title or description (Legal Pages, products, and listings keep theirs)."
      >
        <FieldGrid cols={1}>
          <Field
            label="Default meta title"
            hint="About 50–60 characters. Browser tab and Google title for the homepage and other pages without custom SEO."
          >
            <input
              className="settings-input"
              maxLength={70}
              placeholder="SPLARO | Premium Fashion for Men, Women & Kids"
              value={draft.seo.metaTitle}
              onChange={(e) =>
                setDraft((p) => ({ ...p, seo: { ...p.seo, metaTitle: e.target.value } }))
              }
            />
          </Field>
          <Field
            label="Default meta description"
            hint="About 150–160 characters. Search-result snippet when a page has no custom description."
          >
            <textarea
              className="settings-input min-h-[80px] resize-none"
              maxLength={180}
              placeholder="Shop premium apparel, footwear and accessories for men, women and kids in Bangladesh."
              value={draft.seo.metaDescription}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  seo: { ...p.seo, metaDescription: e.target.value },
                }))
              }
            />
          </Field>
        </FieldGrid>
        <SaveBar
          label="Save default meta"
          saving={saving}
          disabled={!apiOnline}
          onClick={() => save({ seo: draft.seo }, 'Default meta')}
        />
      </SectionCard>

      <SectionCard
        title="Google Search Console"
        subtitle="HTML-tag verification for splaro.co. Paste the token from Search Console → URL prefix property → HTML tag. Save, then click Verify in Google. Rankings stay empty until the property is verified and Workspace OAuth is connected."
      >
        <FieldGrid cols={1}>
          <Field
            label="Google site verification"
            hint="Content value of google-site-verification. Also served as /google{token}.html when NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION is set on the web app."
          >
            <input
              className="settings-input"
              autoComplete="off"
              spellCheck={false}
              placeholder="Paste token from Google Search Console"
              value={draft.seo.googleSiteVerification}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  seo: { ...p.seo, googleSiteVerification: e.target.value },
                }))
              }
            />
          </Field>
        </FieldGrid>
        <SaveBar
          label="Save verification"
          saving={saving}
          disabled={!apiOnline}
          onClick={() => save({ seo: draft.seo }, 'Search Console verification')}
        />
      </SectionCard>
    </div>
  )
}
