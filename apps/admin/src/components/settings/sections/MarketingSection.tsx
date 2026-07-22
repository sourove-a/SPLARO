'use client'

import { useState } from 'react'
import { BarChart3, Hash, Loader2, PlugZap } from 'lucide-react'
import { useTestMetaIntegration } from '@/lib/api/integration-hooks'
import { toastFail, toastIntegrationTestResult } from '@/lib/admin/feedback'
import { SectionCard, SectionPageHeader, FieldGrid, Field, IconInput, SaveBar, type SectionProps } from './shared'

export function MarketingSection({ draft, setDraft, save, saving, apiOnline }: SectionProps) {
  const testMeta = useTestMetaIntegration()
  const [testing, setTesting] = useState(false)

  async function onTestMeta() {
    if (!apiOnline) {
      toastFail('API offline — cannot test Meta Pixel / CAPI.', 'meta-test-offline')
      return
    }
    setTesting(true)
    try {
      const result = await testMeta.mutateAsync()
      toastIntegrationTestResult(result, 'Meta Pixel', 'meta-capi-test')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Meta test failed', 'meta-capi-test-fail')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionPageHeader
        icon={<BarChart3 size={22} />}
        title="Marketing"
        subtitle="Meta Pixel + Conversions API + GA4 — wired for Facebook / Instagram / Google ads purchase tracking."
        badge="Ads-ready"
      />

      <SectionCard title="Tracking pixels" subtitle="Scripts fire on the storefront when IDs are set. Purchase events dedupe via invoice number (browser + CAPI).">
        <FieldGrid>
          <Field label="Facebook Pixel ID" hint="Numeric Pixel ID from Meta Events Manager — no script tags.">
            <IconInput
              icon={<Hash size={14} />}
              placeholder="123456789012345"
              value={draft.marketing.facebookPixelId}
              onChange={(v) => setDraft((p) => ({ ...p, marketing: { ...p.marketing, facebookPixelId: v } }))}
            />
          </Field>
          <Field label="Google Analytics ID" hint="GA4 format: G-XXXXXXXXXX">
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
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            disabled={!apiOnline || testing || testMeta.isPending}
            onClick={() => void onTestMeta()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            {testing || testMeta.isPending ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} />}
            Test Meta Pixel / CAPI
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
            Needs Pixel ID (saved) + <code style={{ fontFamily: 'monospace' }}>FB_CAPI_ACCESS_TOKEN</code> on API/.env
          </span>
        </div>

        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: 12,
            border: '1px solid rgba(16, 17, 20, 0.22)',
            background: 'rgba(16, 17, 20, 0.06)',
            fontSize: '0.75rem',
            color: 'var(--admin-text-muted)',
            lineHeight: 1.65,
          }}
        >
          <strong style={{ color: 'var(--admin-text)' }}>Ads checklist</strong>
          <ol style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem' }}>
            <li>Meta Business → Events Manager → Pixel + Conversions API token</li>
            <li>Domain verify <code style={{ fontFamily: 'monospace' }}>splaro.co</code> + set <code style={{ fontFamily: 'monospace' }}>NEXT_PUBLIC_FACEBOOK_DOMAIN_VERIFICATION</code></li>
            <li>VPS env: <code style={{ fontFamily: 'monospace' }}>NEXT_PUBLIC_FB_PIXEL_ID</code>, <code style={{ fontFamily: 'monospace' }}>FB_PIXEL_ID</code>, <code style={{ fontFamily: 'monospace' }}>FB_CAPI_ACCESS_TOKEN</code></li>
            <li>GA4: <code style={{ fontFamily: 'monospace' }}>NEXT_PUBLIC_GA_MEASUREMENT_ID</code> (or field above)</li>
            <li>
              Google Ads purchase (optional): <code style={{ fontFamily: 'monospace' }}>NEXT_PUBLIC_GOOGLE_ADS_ID=AW-…</code> +{' '}
              <code style={{ fontFamily: 'monospace' }}>NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL=…</code>
            </li>
            <li>Test Events: ViewContent → AddToCart → Checkout → Purchase (invoice id must match)</li>
            <li>Ads: Sales/Conversions campaign optimized for Purchase + UTM on every ad link</li>
          </ol>
        </div>

        <SaveBar label="Save marketing" saving={saving} disabled={!apiOnline} onClick={() => save({ marketing: draft.marketing }, 'Marketing')} />
      </SectionCard>
    </div>
  )
}
