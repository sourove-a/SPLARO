import { Palette } from 'lucide-react'
import { SectionCard, SectionPageHeader, FieldGrid, Field, SaveBar, type SectionProps } from './shared'

export function BrandingSection({ draft, setDraft, save, saving, apiOnline }: SectionProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionPageHeader
        icon={<Palette size={22} />}
        title="Branding"
        subtitle="Logo, favicon, store image, and footer copy."
        badge="Visual"
      />
      <SectionCard title="Logo & favicon" subtitle="Header/footer logo and the small icon shown in the browser tab next to the page title.">
        <FieldGrid cols={1}>
          <Field label="Logo URL (header & footer)">
            <input
              className="settings-input"
              placeholder="https://… or /images/logo/splaro-logo-black-premium.png"
              value={draft.branding.logo}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  branding: { ...p.branding, logo: e.target.value },
                  store: { ...p.store, logo: e.target.value },
                }))
              }
            />
            {(draft.branding.logo || draft.store.logo) ? (
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '1rem 1.25rem',
                  borderRadius: '0.75rem',
                  border: '1px solid rgba(200,169,126,0.25)',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(250,248,245,0.9))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '4.5rem',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={draft.branding.logo || draft.store.logo}
                  alt="Logo preview"
                  style={{ maxHeight: '2.75rem', width: 'auto', objectFit: 'contain' }}
                />
              </div>
            ) : null}
          </Field>
          <Field label="Site icon / favicon (browser tab)">
            <input
              className="settings-input"
              placeholder="/images/logo/splaro-logo-black-premium.png"
              value={draft.branding.favicon}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  branding: { ...p.branding, favicon: e.target.value },
                  store: { ...p.store, favicon: e.target.value },
                }))
              }
            />
            {(draft.branding.favicon || draft.store.favicon) ? (
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '0.85rem 1rem',
                  borderRadius: '0.75rem',
                  border: '1px solid rgba(200,169,126,0.25)',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={draft.branding.favicon || draft.store.favicon}
                  alt="Favicon preview"
                  style={{ width: '2rem', height: '2rem', objectFit: 'contain' }}
                />
                <span style={{ fontSize: '0.82rem', color: 'rgba(17,17,17,0.62)' }}>
                  Browser tab icon preview
                </span>
              </div>
            ) : null}
          </Field>
          <Field label="Store image (footer card)">
            <input
              className="settings-input"
              placeholder="https://…"
              value={draft.branding.storeImage}
              onChange={(e) => setDraft((p) => ({ ...p, branding: { ...p.branding, storeImage: e.target.value } }))}
            />
          </Field>
        </FieldGrid>
        <SaveBar label="Save branding" saving={saving} disabled={!apiOnline} onClick={() => save({ store: draft.store, branding: draft.branding }, 'Branding')} />
      </SectionCard>

      <SectionCard title="Footer copy" subtitle="Text shown at the bottom of every storefront page.">
        <FieldGrid cols={1}>
          <Field label="Store card label">
            <input
              className="settings-input"
              placeholder="SPLARO"
              value={draft.branding.storeLabel}
              onChange={(e) => setDraft((p) => ({ ...p, branding: { ...p.branding, storeLabel: e.target.value } }))}
            />
          </Field>
          <Field label="Footer tagline">
            <input
              className="settings-input"
              placeholder="Crafted for those who dare to be different."
              value={draft.branding.footerTagline}
              onChange={(e) => setDraft((p) => ({ ...p, branding: { ...p.branding, footerTagline: e.target.value } }))}
            />
          </Field>
          <Field label="Copyright line">
            <input
              className="settings-input"
              placeholder="© 2026 SPLARO. All rights reserved."
              value={draft.branding.footerCopyright}
              onChange={(e) => setDraft((p) => ({ ...p, branding: { ...p.branding, footerCopyright: e.target.value } }))}
            />
          </Field>
        </FieldGrid>
        <SaveBar label="Save footer" saving={saving} disabled={!apiOnline} onClick={() => save({ branding: draft.branding }, 'Footer copy')} />
      </SectionCard>
    </div>
  )
}
