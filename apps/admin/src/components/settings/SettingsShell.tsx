'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_CATALOG_CHANNELS, DEFAULT_SHOP_FILTERS } from '@splaro/types'
import { useNewsletterSubscribers, useSettings, useUpdateSettings } from '@/lib/api/hooks'
import { ApiError } from '@/lib/api/client'
import { toastApiSaved, toastFail } from '@/lib/admin/feedback'
import { apiOfflineMessage, apiOfflineSaveMessage } from '@/lib/admin/offline-copy'
import { mergeBrandingDraft } from '@/lib/admin/branding-hydrate'
import { verifySettingsApplied } from '@/lib/admin/settings-save'
import { usePermission } from '@/lib/api/hooks'
import { DEFAULT_HOMEPAGE_SECTIONS, DEFAULT_OUR_STORY, mergeStoryDeckCards } from '@/lib/storefront/homepage-defaults'
import type { AdminSettingsData } from '@/lib/api/settings'
import { SettingsSidebar, type SettingsSection, isSettingsSection } from './SettingsSidebar'
import { FONT, TONE } from '@/components/dc/tokens'
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
  shopFilters: DEFAULT_SHOP_FILTERS,
  catalog: { autoGenerateSku: false },
  payments: { cod: true, bkash: false, sslcommerz: false, nagad: false },
  shipping: { dhakaSameDay: true, outsideDhaka: true, freeShippingMin: '0', dhakaDeliveryCharge: 60, outsideDhakaCharge: 120 },
  smtp: { enabled: false, host: '', port: 587, secure: false, user: '', password: '', fromName: '', fromEmail: '' },
  smtpAccounts: [],
  emailEnabled: false,
  marketing: { facebookPixelId: '', googleAnalyticsId: '' },
  seo: { metaTitle: '', metaDescription: '', googleSiteVerification: '' },
  telegram: null,
}

export function SettingsShell() {
  const { data: apiData, isLoading, isError, refetch } = useSettings()
  const updateSettings = useUpdateSettings()
  const canEditSettings = usePermission('settings', 'edit')
  const [section, setSection] = useState<SettingsSection>('general')
  const changeSection = useCallback((s: SettingsSection, opts?: { hash?: string }) => {
    setSection(s)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('section', s)
      const hash = opts?.hash ?? (s === 'notifications' && url.hash === '#telegram' ? '#telegram' : '')
      // Never drop an intentional deep-link hash (Telegram used to land on SMTP).
      window.history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}${hash}`)
    }
  }, [])
  const [draft, setDraft] = useState<AdminSettingsData>(EMPTY_SETTINGS)
  const settingsLoaded = !isError && !!apiData
  const { data: subscriberData, refetch: refetchSubscribers } = useNewsletterSubscribers(section === 'notifications' && settingsLoaded)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get('section')
    const hash = window.location.hash
    // Old Telegram deep-links pointed at Settings → Notifications#telegram but
    // landed on SMTP. Send them to the dedicated bot screen.
    if (hash === '#telegram' || fromUrl === 'telegram') {
      window.location.replace('/dashboard/telegram-bot')
      return
    }
    if (isSettingsSection(fromUrl)) changeSection(fromUrl)
  }, [changeSection])

  useEffect(() => {
    if (section !== 'notifications' || window.location.hash !== '#telegram') return
    const timer = window.setTimeout(() => {
      document.getElementById('telegram')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
    return () => window.clearTimeout(timer)
  }, [section])

  useEffect(() => {
    if (apiData) {
      setDraft({
        ...EMPTY_SETTINGS,
        ...apiData,
        store: { ...EMPTY_SETTINGS.store, ...(apiData.store ?? {}) },
        branding: mergeBrandingDraft(apiData.branding, apiData.store),
        contact: { ...EMPTY_SETTINGS.contact, ...(apiData.contact ?? {}) },
        social: { ...EMPTY_SETTINGS.social, ...(apiData.social ?? {}) },
        shipping: {
          ...EMPTY_SETTINGS.shipping,
          ...(apiData.shipping ?? {}),
          dhakaSameDay: apiData.shipping?.dhakaSameDay ?? true,
          outsideDhaka: apiData.shipping?.outsideDhaka ?? true,
          dhakaDeliveryCharge: Number(apiData.shipping?.dhakaDeliveryCharge ?? 60),
          outsideDhakaCharge: Number(apiData.shipping?.outsideDhakaCharge ?? 120),
          freeShippingMin: String(apiData.shipping?.freeShippingMin ?? '0'),
        },
        payments: { ...EMPTY_SETTINGS.payments, ...(apiData.payments ?? {}) },
        marketing: { ...EMPTY_SETTINGS.marketing, ...(apiData.marketing ?? {}) },
        seo: { ...EMPTY_SETTINGS.seo, ...(apiData.seo ?? {}) },
        smtp: { ...EMPTY_SETTINGS.smtp, ...(apiData.smtp ?? {}), password: '' },
        smtpAccounts: (apiData.smtpAccounts ?? []).map((account) => ({ ...account, password: '' })),
        newsletter: { ...EMPTY_SETTINGS.newsletter, ...(apiData.newsletter ?? {}) },
        ourStory: {
          ...DEFAULT_OUR_STORY,
          ...(apiData.ourStory ?? {}),
          pillars: apiData.ourStory?.pillars?.length ? apiData.ourStory.pillars : DEFAULT_OUR_STORY.pillars,
          storyDeckCards: mergeStoryDeckCards(apiData.ourStory?.storyDeckCards),
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
        shopFilters: apiData.shopFilters ?? DEFAULT_SHOP_FILTERS,
        menuOverrides: apiData.menuOverrides ?? { autoSync: true, departments: [] },
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
        <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--admin-danger-bright)' }}>Cannot load settings</p>
        <p style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)', maxWidth: 420, textAlign: 'center' }}>
          {apiOfflineMessage('settings')}
        </p>
        <button type="button" className="settings-save-btn" onClick={() => void refetch()}>
          Retry connection
        </button>
      </div>
    )
  }

  const save = (patch: Partial<AdminSettingsData>, label: string, onSuccess?: () => void) => {
    if (!settingsLoaded) {
      toastFail(apiOfflineSaveMessage(), 'settings-api-offline')
      return
    }
    if (!canEditSettings) {
      toastFail('You do not have permission to change settings.', 'settings-perm-denied')
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

  const sharedProps = { draft, setDraft, save, saving, apiOnline: settingsLoaded && canEditSettings }

  return (
    <div
      className="settings-layout settings-layout--advanced settings-shell settings-shell--dc"
      data-settings-shell
      data-chrome="off"
    >
      <aside className="settings-sidebar-panel settings-sidebar-nav">
        <SettingsSidebar active={section} onChange={changeSection} settingsLoaded={settingsLoaded} />
      </aside>

      <div className="settings-layout__main">
        {!settingsLoaded || !canEditSettings ? (
          <p
            className="dc-settings-notice"
            style={{
              background: TONE.warn.bg,
              color: TONE.warn.fg,
              borderColor: TONE.warn.bd,
              font: `600 12px/1.5 ${FONT}`,
            }}
          >
            {!settingsLoaded
              ? `${apiOfflineSaveMessage()} Use Retry health check in the sidebar.`
              : 'You do not have permission to save settings.'}
          </p>
        ) : null}
        <div className="settings-advanced-panel dc-settings-panel !mt-3">
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
    </div>
  )
}
