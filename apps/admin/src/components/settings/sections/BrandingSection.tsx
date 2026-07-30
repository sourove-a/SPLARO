import { Palette } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { SectionCard, SectionPageHeader, FieldGrid, Field, SaveBar, type SectionProps } from './shared'

const DEFAULT_FOOTER = {
  storeLabel: 'Store',
  footerTagline: 'Crafted for those who dare to be different.',
  footerCopyright: '© 2026 SPLARO. All rights reserved.',
}

const DEFAULT_LOGO = '/images/logo/splaro-logo-black-premium.webp'

export function BrandingSection({ draft, setDraft, save, saving, apiOnline }: SectionProps) {
  const footerSparse =
    !draft.branding.footerTagline?.trim() ||
    !draft.branding.footerCopyright?.trim() ||
    !draft.branding.storeLabel?.trim()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionPageHeader
        icon={<Palette size={22} />}
        title="Branding"
        subtitle="Logo, favicon, store image, and footer copy shown on every storefront page."
        badge="Visual"
      />
      <SectionCard
        title="Logo & favicon"
        subtitle="Header/footer logo and the small icon in the browser tab next to the page title."
      >
        <FieldGrid cols={1}>
          <Field
            label="Logo URL (header & footer)"
            hint="Prefer /images/logo/splaro-logo-*-premium.webp (~10KB). Avoid 500KB+ PNG wordmarks."
          >
            <input
              className="settings-input"
              placeholder={DEFAULT_LOGO}
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
                  border: '1px solid rgba(16, 17, 20, 0.25)',
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
            ) : (
              <div style={{ marginTop: '0.55rem' }}>
                <AdminButton
                  size="sm"
                  variant="ghost"
                  disabled={!apiOnline || saving}
                  onClick={() => {
                    const branding = { ...draft.branding, logo: DEFAULT_LOGO }
                    const store = { ...draft.store, logo: DEFAULT_LOGO }
                    setDraft((p) => ({ ...p, branding, store }))
                    save({ store, branding }, 'Logo')
                  }}
                >
                  Use default SPLARO logo
                </AdminButton>
              </div>
            )}
          </Field>
          <Field
            label="Site icon / favicon (browser tab)"
            hint="Square mark works best. Same path as logo is fine for a quick start."
          >
            <input
              className="settings-input"
              placeholder={DEFAULT_LOGO}
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
                  border: '1px solid rgba(16, 17, 20, 0.25)',
                  background: 'var(--admin-color-white)',
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
          <Field
            label="Store image (footer card)"
            hint="Optional photo for the footer store card. Leave empty to hide the image."
          >
            <input
              className="settings-input"
              placeholder="https://… or /images/…"
              value={draft.branding.storeImage}
              onChange={(e) => setDraft((p) => ({ ...p, branding: { ...p.branding, storeImage: e.target.value } }))}
            />
          </Field>
        </FieldGrid>
        <SaveBar
          label="Save branding"
          saving={saving}
          disabled={!apiOnline}
          onClick={() => save({ store: draft.store, branding: draft.branding }, 'Branding')}
        />
      </SectionCard>

      <SectionCard title="Footer copy" subtitle="Text shown at the bottom of every storefront page.">
        <FieldGrid cols={1}>
          <Field label="Store card label" hint="Short label above the footer store block (e.g. Store).">
            <input
              className="settings-input"
              placeholder={DEFAULT_FOOTER.storeLabel}
              value={draft.branding.storeLabel}
              onChange={(e) => setDraft((p) => ({ ...p, branding: { ...p.branding, storeLabel: e.target.value } }))}
            />
          </Field>
          <Field label="Footer tagline" hint="One-line brand line under the logo in the footer.">
            <input
              className="settings-input"
              placeholder={DEFAULT_FOOTER.footerTagline}
              value={draft.branding.footerTagline}
              onChange={(e) => setDraft((p) => ({ ...p, branding: { ...p.branding, footerTagline: e.target.value } }))}
            />
          </Field>
          <Field label="Copyright line" hint="Legal line at the very bottom. Update the year each January.">
            <input
              className="settings-input"
              placeholder={DEFAULT_FOOTER.footerCopyright}
              value={draft.branding.footerCopyright}
              onChange={(e) =>
                setDraft((p) => ({ ...p, branding: { ...p.branding, footerCopyright: e.target.value } }))
              }
            />
          </Field>
        </FieldGrid>
        {footerSparse ? (
          <div style={{ marginBottom: '0.75rem' }}>
            <AdminButton
              size="sm"
              variant="ghost"
              disabled={!apiOnline || saving}
              onClick={() => {
                const branding = { ...draft.branding, ...DEFAULT_FOOTER }
                setDraft((p) => ({ ...p, branding }))
                save({ branding }, 'Footer copy')
              }}
            >
              Fill recommended footer copy
            </AdminButton>
          </div>
        ) : null}
        <SaveBar
          label="Save footer"
          saving={saving}
          disabled={!apiOnline}
          onClick={() => save({ branding: draft.branding }, 'Footer copy')}
        />
      </SectionCard>
    </div>
  )
}
