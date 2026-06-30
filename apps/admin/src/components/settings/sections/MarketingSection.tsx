import { BarChart3, Hash } from 'lucide-react'
import { SectionCard, SectionPageHeader, FieldGrid, Field, IconInput, SaveBar, type SectionProps } from './shared'

export function MarketingSection({ draft, setDraft, save, saving, apiOnline }: SectionProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionPageHeader
        icon={<BarChart3 size={22} />}
        title="Marketing"
        subtitle="Facebook Pixel, Google Analytics — tracking scripts injected into the storefront."
        badge="Analytics"
      />

      <SectionCard title="Tracking pixels" subtitle="Scripts fire on every storefront page when IDs are set.">
        <FieldGrid>
          <Field label="Facebook Pixel ID" hint="Paste your numeric Pixel ID — no script tags needed.">
            <IconInput
              icon={<Hash size={14} />}
              placeholder="123456789012345"
              value={draft.marketing.facebookPixelId}
              onChange={(v) => setDraft((p) => ({ ...p, marketing: { ...p.marketing, facebookPixelId: v } }))}
            />
          </Field>
          <Field label="Google Analytics ID" hint="Format: G-XXXXXXXXXX or UA-XXXXXXXX-X">
            <IconInput
              icon={<Hash size={14} />}
              placeholder="G-XXXXXXXXXX"
              value={draft.marketing.googleAnalyticsId}
              onChange={(v) => setDraft((p) => ({ ...p, marketing: { ...p.marketing, googleAnalyticsId: v } }))}
            />
          </Field>
        </FieldGrid>
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: 12,
            border: '1px solid rgba(200,169,126,0.22)',
            background: 'rgba(200,169,126,0.06)',
            fontSize: '0.75rem',
            color: 'var(--admin-text-muted)',
            lineHeight: 1.6,
          }}
        >
          Scripts are injected via <code style={{ color: '#5e7cff', fontFamily: 'monospace' }}>layout.tsx</code> only when IDs are non-empty. Changes apply on next full page load.
        </div>
        <SaveBar label="Save marketing" saving={saving} disabled={!apiOnline} onClick={() => save({ marketing: draft.marketing }, 'Marketing')} />
      </SectionCard>
    </div>
  )
}
