'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_CATALOG_CHANNELS } from '@splaro/types'
import { useNewsletterSubscribers, useSettings, useUpdateSettings } from '@/lib/api/hooks'
import { ApiError } from '@/lib/api/client'
import { toastApiSaved, toastFail } from '@/lib/admin/feedback'
import { verifySettingsApplied } from '@/lib/admin/settings-save'
import { DEFAULT_HOMEPAGE_SECTIONS, DEFAULT_OUR_STORY } from '@/lib/storefront/homepage-defaults'
import type { AdminSettingsData } from '@/lib/api/settings'
import { SettingsSidebar, type SettingsSection, isSettingsSection } from './SettingsSidebar'
import { ModuleLiveStrip } from '@/components/ui/connection/ModuleLiveStrip'
import { GeneralSection } from './sections/GeneralSection'
import { BrandingSection } from './sections/BrandingSection'
import { ContactSection } from './sections/ContactSection'
import { HomepageSection } from './sections/HomepageSection'
import { NavigationSection } from './sections/NavigationSection'
import { PaymentsSection } from './sections/PaymentsSection'
import { ShippingSection } from './sections/ShippingSection'
import { NotificationsSection } from './sections/NotificationsSection'
import { MarketingSection } from './sections/MarketingSection'
import { DomainSection } from './sections/DomainSection'
import { InfrastructureSection } from './sections/InfrastructureSection'

export const EMPTY_SETTINGS: AdminSettingsData = {
  store: { name: '', email: '', phone: '', domain: '', currency: 'BDT', timezone: 'Asia/Dhaka', logo: '', favicon: '', description: '', address: '' },
  branding: { logo: '', favicon: '', storeImage: '', storeLabel: 'Store', footerTagline: '', footerCopyright: '' },
  contact: { email: '', phone: '', whatsapp: '', address: '' },
  social: { instagram: '', facebook: '', tiktok: '', youtube: '' },
  navigation: { headerNav: [], footerGroups: [] },
  marquee: { enabled: false, items: [] },
  specialOffer: { enabled: false, template: 'countdown', title: '', ctaLabel: 'Shop now', ctaHref: '/shop' },
  newsletter: { enabled: false, eyebrow: '', title: '', subtitle: '', placeholder: '', buttonLabel: '', note: '', perks: [] },
  ourStory: DEFAULT_OUR_STORY,
  homepage: DEFAULT_HOMEPAGE_SECTIONS,
  catalogChannels: DEFAULT_CATALOG_CHANNELS.map((c) => ({ ...c })),
  catalog: { autoGenerateSku: false },
  payments: { cod: true, bkash: true, sslcommerz: true, nagad: true },
  shipping: { dhakaSameDay: true, outsideDhaka: true, freeShippingMin: '0', dhakaDeliveryCharge: 60, outsideDhakaCharge: 120 },
  smtp: { enabled: false, host: '', port: 587, secure: false, user: '', password: '', fromName: '', fromEmail: '' },
  emailEnabled: false,
  marketing: { facebookPixelId: '', googleAnalyticsId: '' },
  telegram: null,
}

export function SettingsShell() {
  const { data: apiData, isLoading, isError, refetch } = useSettings()
  const updateSettings = useUpdateSettings()
  const [section, setSection] = useState<SettingsSection>('general')
  const [animKey, setAnimKey] = useState(0)
  const changeSection = useCallback((s: SettingsSection) => {
    setSection(s)
    setAnimKey((k) => k + 1)
  }, [])
  const [draft, setDraft] = useState<AdminSettingsData>(EMPTY_SETTINGS)
  const settingsLoaded = !isError && !!apiData
  const { data: subscriberData, refetch: refetchSubscribers } = useNewsletterSubscribers(section === 'notifications' && settingsLoaded)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get('section')
    if (isSettingsSection(fromUrl)) changeSection(fromUrl)
  }, [changeSection])

  useEffect(() => {
    if (apiData) {
      setDraft({
        ...EMPTY_SETTINGS,
        ...apiData,
        smtp: { ...EMPTY_SETTINGS.smtp, ...(apiData.smtp ?? {}), password: '' },
        newsletter: { ...EMPTY_SETTINGS.newsletter, ...(apiData.newsletter ?? {}) },
        ourStory: {
          ...DEFAULT_OUR_STORY,
          ...(apiData.ourStory ?? {}),
          pillars: apiData.ourStory?.pillars?.length ? apiData.ourStory.pillars : DEFAULT_OUR_STORY.pillars,
          customerStories: {
            ...DEFAULT_OUR_STORY.customerStories,
            ...(apiData.ourStory?.customerStories ?? {}),
            stories: apiData.ourStory?.customerStories?.stories?.length
              ? apiData.ourStory.customerStories.stories
              : DEFAULT_OUR_STORY.customerStories.stories,
          },
        },
        homepage: { ...DEFAULT_HOMEPAGE_SECTIONS, ...(apiData.homepage ?? {}) },
        catalogChannels: apiData.catalogChannels?.length
          ? apiData.catalogChannels
          : DEFAULT_CATALOG_CHANNELS.map((c) => ({ ...c })),
        catalog: { ...(apiData.catalog ?? {}), autoGenerateSku: apiData.catalog?.autoGenerateSku ?? false },
      })
    }
  }, [apiData])

  if (isLoading && !apiData) {
    return (
      <div className="settings-loading-panel admin-panel-glass-subtle">
        <svg
          style={{ height: 22, width: 22, color: 'var(--admin-text-secondary)', animation: 'spin 1s linear infinite' }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--admin-text-muted)' }}>
          Loading settings from API…
        </p>
      </div>
    )
  }

  if (isError && !apiData) {
    return (
      <div className="settings-loading-panel admin-panel-glass-subtle" style={{ borderColor: 'rgba(239,68,68,0.35)' }}>
        <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#ef4444' }}>Cannot load settings</p>
        <p style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)', maxWidth: 420, textAlign: 'center' }}>
          API is not reachable. Run <code>pnpm dev:stack</code> (or <code>pnpm dev:api</code>), then retry.
        </p>
        <button type="button" className="settings-save-btn" onClick={() => void refetch()}>
          Retry connection
        </button>
      </div>
    )
  }

  const save = (patch: Partial<AdminSettingsData>, label: string, onSuccess?: () => void) => {
    if (!settingsLoaded) {
      toastFail('API offline — settings not loaded. Start API and refresh.', 'settings-api-offline')
      return
    }
    updateSettings.mutate(patch, {
      onSuccess: (updated) => {
        const verified = verifySettingsApplied(patch, updated)
        if (!verified.ok) {
          toastFail(`Save failed — ${verified.reason}`, 'settings-verify-fail')
          void refetch()
          return
        }
        setDraft((prev) => ({
          ...prev,
          ...updated,
          smtp: { ...prev.smtp, ...(updated.smtp ?? {}), password: '' },
          catalog: { ...prev.catalog, ...(updated.catalog ?? {}) },
        }))
        toastApiSaved(label)
        onSuccess?.()
      },
      onError: (err) => {
        const detail = err instanceof ApiError ? err.message : 'Check API connection'
        toastFail(`Save failed — ${detail}`, 'settings-save-fail')
      },
    })
  }

  const saving = updateSettings.isPending

  const sharedProps = { draft, setDraft, save, saving, apiOnline: settingsLoaded }

  return (
    <div
      style={{
        display: 'flex',
        gap: '1.25rem',
        minHeight: 0,
        alignItems: 'flex-start',
      }}
    >
      <aside className="settings-sidebar-panel settings-sidebar-nav">
        <SettingsSidebar active={section} onChange={changeSection} settingsLoaded={settingsLoaded} />
      </aside>

      <div key={animKey} className="settings-section-enter" style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <ModuleLiveStrip
          onRefresh={() => void refetch()}
          items={[
            {
              label: 'Settings API',
              value: settingsLoaded ? 'Loaded from server' : 'Offline',
              ok: settingsLoaded,
              hint: 'GET /admin/settings',
            },
            {
              label: 'SKU policy',
              value: draft.catalog.autoGenerateSku ? 'Auto-generate on' : 'Manual entry (live)',
              ok: !draft.catalog.autoGenerateSku,
              hint: 'General → Catalog & SKU policy',
            },
            {
              label: 'Save',
              value: saving ? 'Saving…' : 'Verified PATCH',
              ok: settingsLoaded && !saving,
            },
          ]}
        />
        {!settingsLoaded ? (
          <div
            className="admin-settings-status admin-settings-status--offline"
            style={{ marginBottom: 0 }}
          >
            <p className="flex items-center gap-2 text-xs font-semibold text-amber-900">
              API offline — save is disabled until connection is restored.
            </p>
          </div>
        ) : null}
        {section === 'general' && <GeneralSection {...sharedProps} />}
        {section === 'branding' && <BrandingSection {...sharedProps} />}
        {section === 'contact' && <ContactSection {...sharedProps} />}
        {section === 'homepage' && <HomepageSection {...sharedProps} />}
        {section === 'navigation' && <NavigationSection {...sharedProps} />}
        {section === 'payments' && <PaymentsSection {...sharedProps} />}
        {section === 'shipping' && <ShippingSection {...sharedProps} />}
        {section === 'notifications' && (
          <NotificationsSection
            {...sharedProps}
            subscriberData={subscriberData}
            onRefreshSubscribers={() => void refetchSubscribers()}
          />
        )}
        {section === 'marketing' && <MarketingSection {...sharedProps} />}
        {section === 'infrastructure' && <InfrastructureSection apiOnline={settingsLoaded} />}
        {section === 'domain' && <DomainSection {...sharedProps} />}
      </div>
    </div>
  )
}
