'use client'

import { useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  BookOpen,
  Home,
  Inbox,
  LayoutGrid,
  Link2,
  Mail,
  MapPin,
  Megaphone,
  Menu,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Store,
  Trash2,
  Truck,
  Wifi,
  WifiOff,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { AdminButton } from '@/components/ui/AdminButton'
import { toastApiSaved, toastFail, toastWarn } from '@/lib/admin/feedback'
import { verifySettingsApplied } from '@/lib/admin/settings-save'
import { DEFAULT_HOMEPAGE_SECTIONS, DEFAULT_OUR_STORY, mergeStoryDeckCards } from '@/lib/storefront/homepage-defaults'
import {
  DEFAULT_CATALOG_CHANNELS,
  DEFAULT_SHOP_FILTERS,
  isHrefBlockedByCatalogChannels,
  mergeShopFilters,
} from '@splaro/types'
import { SPLARO_DOMAINS } from '@splaro/config'
import { useNewsletterSubscribers, useSettings, useUpdateSettings } from '@/lib/api/hooks'
import type { AdminSettingsData, FooterGroup, NavLink } from '@/lib/api/settings'
import { cn } from '@/lib/utils/cn'

const panelLoading = () => <p className="text-sm font-semibold text-[var(--admin-color-neutral-500)]">Loading panel…</p>

// Heavy tab panels are code-split so the first tab paints instantly.
const CatalogVisibilityPanel = dynamic(
  () => import('@/components/modules/CatalogVisibilityPanel').then((m) => m.CatalogVisibilityPanel),
  { loading: panelLoading },
)
const MenuBuilderPanel = dynamic(
  () => import('@/components/modules/MenuBuilderPanel').then((m) => m.MenuBuilderPanel),
  { loading: panelLoading },
)
const ShopFiltersPanel = dynamic(
  () => import('@/components/modules/ShopFiltersPanel').then((m) => m.ShopFiltersPanel),
  { loading: panelLoading },
)
const HomepageVisibilityPanel = dynamic(
  () => import('@/components/modules/HomepageVisibilityPanel').then((m) => m.HomepageVisibilityPanel),
  { loading: panelLoading },
)
const NewsletterAdminPreview = dynamic(
  () => import('@/components/modules/NewsletterAdminPreview').then((m) => m.NewsletterAdminPreview),
  { loading: panelLoading },
)
const OurStoryAdminPanel = dynamic(
  () => import('@/components/modules/OurStoryAdminPanel').then((m) => m.OurStoryAdminPanel),
  { loading: panelLoading },
)

type TabId = 'brand' | 'location' | 'navigation' | 'catalog' | 'shopFilters' | 'footer' | 'homepage' | 'marquee' | 'offers' | 'story' | 'newsletter' | 'shipping' | 'smtp'

const TABS: { id: TabId; label: string; icon: typeof Store }[] = [
  { id: 'brand', label: 'Brand & logo', icon: Store },
  { id: 'location', label: 'Location & contact', icon: MapPin },
  { id: 'navigation', label: 'Menu', icon: Menu },
  { id: 'catalog', label: 'Catalog', icon: Eye },
  { id: 'shopFilters', label: 'Shop filters', icon: SlidersHorizontal },
  { id: 'footer', label: 'Footer', icon: LayoutGrid },
  { id: 'homepage', label: 'Homepage', icon: Home },
  { id: 'marquee', label: 'Marquee', icon: Megaphone },
  { id: 'offers', label: 'Offers', icon: Sparkles },
  { id: 'story', label: 'Our Story', icon: BookOpen },
  { id: 'newsletter', label: 'Newsletter', icon: Inbox },
  { id: 'shipping', label: 'Shipping & pay', icon: Truck },
  { id: 'smtp', label: 'SMTP & email', icon: Mail },
]

const OFFER_TEMPLATES = [
  { id: 'countdown', label: 'Countdown', hint: 'Dark hero with live timer' },
  { id: 'banner', label: 'Banner', hint: 'Wide promo strip on homepage' },
  { id: 'minimal', label: 'Minimal', hint: 'Short text block only' },
] as const

const MOBILE_HOMEPAGE_SECTIONS: Array<{
  key: keyof AdminSettingsData['homepage']
  title: string
  sub: string
}> = [
  { key: 'hero', title: 'Hero slider', sub: 'homepage lead campaign' },
  { key: 'marquee', title: 'Marquee strip', sub: 'announcement row' },
  { key: 'specialOffer', title: 'Special offer band', sub: 'limited-time promotion' },
  { key: 'instagram', title: 'Instagram strip', sub: 'social product gallery' },
  { key: 'newsletter', title: 'Newsletter block', sub: 'customer signup section' },
]

const EMPTY_SETTINGS: AdminSettingsData = {
  store: { name: '', email: '', phone: '', domain: '', currency: 'BDT', timezone: 'Asia/Dhaka', logo: '', favicon: '', description: '', address: '' },
  branding: { logo: '', favicon: '', storeImage: '', storeLabel: 'Store', footerTagline: '', footerCopyright: '' },
  contact: { email: '', phone: '', whatsapp: '', address: '' },
  social: { instagram: '', facebook: '', tiktok: '', youtube: '' },
  navigation: { headerNav: [], footerGroups: [] },
  menuOverrides: { autoSync: true, departments: [] },
  marquee: { enabled: false, items: [] },
  specialOffer: { enabled: false, template: 'countdown', title: '', subtitle: '', badge: '', discountLabel: '', ctaLabel: 'Shop now', ctaHref: '/shop', endsAt: null },
  newsletter: {
    enabled: true,
    eyebrow: 'Stay connected',
    title: 'Be the first to know.',
    subtitle: 'New drops, exclusive offers & styling inspiration — straight to your inbox.',
    placeholder: 'Your email address',
    buttonLabel: 'Subscribe',
    note: 'No spam. Unsubscribe anytime.',
    perks: ['Early access to drops', 'Member-only offers', 'Style notes & care tips'],
  },
  ourStory: DEFAULT_OUR_STORY,
  homepage: DEFAULT_HOMEPAGE_SECTIONS,
  catalogChannels: DEFAULT_CATALOG_CHANNELS.map((channel) => ({ ...channel })),
  shopFilters: DEFAULT_SHOP_FILTERS,
  catalog: { autoGenerateSku: false },
  payments: { cod: true, bkash: true, sslcommerz: true, nagad: true },
  shipping: { dhakaSameDay: true, outsideDhaka: true, freeShippingMin: '0', dhakaDeliveryCharge: 60, outsideDhakaCharge: 120 },
  smtp: { enabled: false, host: '', port: 587, secure: false, user: '', password: '', fromName: 'SPLARO', fromEmail: '', replyTo: '' },
  smtpAccounts: [],
  emailEnabled: true,
  marketing: { facebookPixelId: '', googleAnalyticsId: '' },
}

interface StorefrontControlPanelProps {
  initialTab?: TabId
}

export function StorefrontControlPanel({ initialTab = 'brand' }: StorefrontControlPanelProps) {
  const { data: apiData, isLoading, isError } = useSettings()
  const updateSettings = useUpdateSettings()
  const [tab, setTab] = useState<TabId>(initialTab)
  const [draft, setDraft] = useState<AdminSettingsData>(EMPTY_SETTINGS)
  const apiOnline = !isError && !!apiData
  const { data: subscriberData, refetch: refetchSubscribers } = useNewsletterSubscribers(tab === 'newsletter' && apiOnline)
  const liveHeaderLinks = draft.navigation.headerNav.filter(
    (item) => !item.hidden && !isHrefBlockedByCatalogChannels(item.href, draft.catalogChannels),
  ).length

  useEffect(() => {
    if (apiData) {
      setDraft({
        ...EMPTY_SETTINGS,
        ...apiData,
        smtp: { ...EMPTY_SETTINGS.smtp, ...(apiData.smtp ?? {}) },
        newsletter: { ...EMPTY_SETTINGS.newsletter, ...(apiData.newsletter ?? {}) },
        ourStory: {
          ...DEFAULT_OUR_STORY,
          ...(apiData.ourStory ?? {}),
          customerStories: {
            ...DEFAULT_OUR_STORY.customerStories,
            ...(apiData.ourStory?.customerStories ?? {}),
            stories: apiData.ourStory?.customerStories?.stories?.length
              ? apiData.ourStory.customerStories.stories
              : DEFAULT_OUR_STORY.customerStories.stories,
          },
          pillars: apiData.ourStory?.pillars?.length ? apiData.ourStory.pillars : DEFAULT_OUR_STORY.pillars,
          storyDeckCards: mergeStoryDeckCards(apiData.ourStory?.storyDeckCards),
        },
        homepage: { ...DEFAULT_HOMEPAGE_SECTIONS, ...(apiData.homepage ?? {}) },
        catalogChannels: apiData.catalogChannels?.length
          ? apiData.catalogChannels
          : DEFAULT_CATALOG_CHANNELS.map((channel) => ({ ...channel })),
        shopFilters: mergeShopFilters(apiData.shopFilters),
        catalog: { ...(apiData.catalog ?? {}), autoGenerateSku: apiData.catalog?.autoGenerateSku ?? false },
        menuOverrides: apiData.menuOverrides ?? { autoSync: true, departments: [] },
      })
    }
  }, [apiData])

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])

  if (isLoading && !apiData) {
    return <p className="text-sm font-semibold text-[var(--admin-color-neutral-500)]">Loading storefront settings…</p>
  }

  const save = (section: Partial<AdminSettingsData>, label: string, onSuccess?: () => void) => {
    if (!apiOnline) {
      toastFail('API offline — settings not loaded. Start API and refresh.', 'settings-api-offline')
      return
    }
    updateSettings.mutate(section, {
      onSuccess: (data) => {
        const verified = verifySettingsApplied(section, data)
        if (!verified.ok) {
          toastFail(`Save failed — ${verified.reason}`, 'settings-verify-fail')
          return
        }
        setDraft(data)
        toastApiSaved(label)
        onSuccess?.()
      },
      onError: (err) => {
        const detail = err instanceof Error ? err.message : 'Check API connection'
        toastFail(`Save failed — ${detail}`, `settings-save-fail:${label}`)
      },
    })
  }

  const updateNavItem = (index: number, patch: Partial<NavLink>) => {
    setDraft((prev) => ({
      ...prev,
      navigation: {
        ...prev.navigation,
        headerNav: prev.navigation.headerNav.map((item, i) => (i === index ? { ...item, ...patch } : item)),
      },
    }))
  }

  const updateFooterGroup = (groupIndex: number, patch: Partial<FooterGroup>) => {
    setDraft((prev) => ({
      ...prev,
      navigation: {
        ...prev.navigation,
        footerGroups: prev.navigation.footerGroups.map((group, i) =>
          i === groupIndex ? { ...group, ...patch } : group,
        ),
      },
    }))
  }

  const toggleNavVisibility = (index: number) => {
    const savedNav = apiData?.navigation.headerNav ?? []
    if (JSON.stringify(draft.navigation.headerNav) !== JSON.stringify(savedNav)) {
      toastWarn('Save link text changes first — visibility was not changed.')
      return
    }
    const item = draft.navigation.headerNav[index]
    if (!item) return
    const nextHidden = !item.hidden
    const navigation = {
      ...draft.navigation,
      headerNav: draft.navigation.headerNav.map((nav, i) =>
        i === index ? { ...nav, hidden: nextHidden } : nav,
      ),
    }
    save(
      { navigation },
      nextHidden ? `${item.label || 'Link'} hidden` : `${item.label || 'Link'} shown`,
    )
  }

  const moveNavItem = (index: number, direction: -1 | 1) => {
    const savedNav = apiData?.navigation.headerNav ?? []
    if (JSON.stringify(draft.navigation.headerNav) !== JSON.stringify(savedNav)) {
      toastWarn('Save link text changes first — order was not changed.')
      return
    }
    const swapIndex = index + direction
    if (swapIndex < 0 || swapIndex >= draft.navigation.headerNav.length) return
    const headerNav = [...draft.navigation.headerNav]
    ;[headerNav[index], headerNav[swapIndex]] = [headerNav[swapIndex]!, headerNav[index]!]
    save({ navigation: { ...draft.navigation, headerNav } }, 'Header menu order')
  }

  const removeNavItem = (index: number) => {
    if (draft.navigation.headerNav.length <= 1) {
      toastWarn('Keep one header link. Hide it if storefront header should show none.')
      return
    }
    setDraft((prev) => ({
      ...prev,
      navigation: {
        ...prev.navigation,
        headerNav: prev.navigation.headerNav.filter((_, itemIndex) => itemIndex !== index),
      },
    }))
  }

  const saveHeaderNav = () => {
    const normalized = draft.navigation.headerNav.map((item) => ({
      ...item,
      label: item.label.trim(),
      href: item.href.trim(),
    }))
    const invalid = normalized.find(
      (item) =>
        !item.label ||
        !item.href ||
        !(
          item.href.startsWith('/') ||
          item.href.startsWith('https://') ||
          item.href.startsWith('http://') ||
          item.href.startsWith('mailto:') ||
          item.href.startsWith('tel:')
        ),
    )
    if (invalid) {
      toastWarn('Every link needs label + valid destination. Nothing was saved.')
      return
    }
    const duplicate = normalized.find(
      (item, index) =>
        normalized.findIndex(
          (candidate) =>
            candidate.label.toLowerCase() === item.label.toLowerCase() &&
            candidate.href === item.href,
        ) !== index,
    )
    if (duplicate) {
      toastWarn(`Duplicate menu link “${duplicate.label}”. Nothing was saved.`)
      return
    }
    save({ navigation: { ...draft.navigation, headerNav: normalized } }, 'Header menu links')
  }

  const toggleHomepageSection = (key: keyof AdminSettingsData['homepage']) => {
    const homepage = { ...draft.homepage, [key]: !draft.homepage[key] }
    const label = MOBILE_HOMEPAGE_SECTIONS.find((section) => section.key === key)?.title ?? 'Homepage section'
    save({ homepage }, `${label} ${homepage[key] ? 'shown' : 'hidden'}`)
  }

  return (
    <div className="storefront-control-panel space-y-5" data-initial-tab={initialTab}>
      <div
        className={cn(
          'admin-settings-status',
          apiOnline ? 'admin-settings-status--online' : 'admin-settings-status--offline',
        )}
      >
        <p className={cn('flex items-center gap-2 text-xs font-semibold', apiOnline ? 'text-emerald-900' : 'text-amber-900')}>
          {apiOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          {apiOnline
            ? 'Live control — logo, menu, footer, offers, SMTP & location save to your store.'
            : 'Start API + database to control the live storefront.'}
        </p>
        <span className="flex items-center gap-2">
          <span className={cn('admin-conn-strip__pulse', !apiOnline && 'admin-conn-strip__pulse--warn')}>
            <span className="admin-conn-strip__pulse-dot" />
            {apiOnline ? 'Settings loaded' : 'Offline'}
          </span>
          <a
            href={SPLARO_DOMAINS.site}
            target="_blank"
            rel="noreferrer"
            className="admin-conn-strip__refresh no-underline"
          >
            View store
          </a>
        </span>
      </div>

      <div className="admin-tab-row flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn('admin-tab-pill', tab === item.id && 'admin-tab-pill--active')}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        ))}
      </div>

      <div key={tab} className="settings-section-enter space-y-5">
      {tab === 'brand' ? (
        <section className="admin-module-card admin-module-card--accent">
          <h3 className="admin-module-card__title">Brand & logo</h3>
          <p className="admin-module-card__subtitle mb-4">Store identity shown in header, footer and browser tab.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="admin-field md:col-span-2">
              <span className="admin-kpi__label">Store name</span>
              <input className="admin-input" value={draft.store.name} onChange={(e) => setDraft((p) => ({ ...p, store: { ...p.store, name: e.target.value } }))} />
            </label>
            <label className="admin-field md:col-span-2">
              <span className="admin-kpi__label">Logo URL</span>
              <input className="admin-input" placeholder="https://… or /images/logo/splaro-logo-black-premium.png" value={draft.branding.logo} onChange={(e) => setDraft((p) => ({ ...p, branding: { ...p.branding, logo: e.target.value }, store: { ...p.store, logo: e.target.value } }))} />
            </label>
            <label className="admin-field md:col-span-2">
              <span className="admin-kpi__label">Store image (footer card)</span>
              <input className="admin-input" placeholder="https://…" value={draft.branding.storeImage} onChange={(e) => setDraft((p) => ({ ...p, branding: { ...p.branding, storeImage: e.target.value } }))} />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">Footer tagline</span>
              <input className="admin-input" placeholder="Leave empty to hide" value={draft.branding.footerTagline} onChange={(e) => setDraft((p) => ({ ...p, branding: { ...p.branding, footerTagline: e.target.value } }))} />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">Copyright line</span>
              <input className="admin-input" placeholder="© 2026 SPLARO. All rights reserved." value={draft.branding.footerCopyright} onChange={(e) => setDraft((p) => ({ ...p, branding: { ...p.branding, footerCopyright: e.target.value } }))} />
            </label>
          </div>
          <AdminButton variant="gold" className="mt-4" loading={updateSettings.isPending} onClick={() => save({ store: draft.store, branding: draft.branding }, 'Brand settings')}>
            Save brand
          </AdminButton>
        </section>
      ) : null}

      {tab === 'location' ? (
        <section className="admin-module-card">
          <h3 className="admin-module-card__title mb-4">Location & contact</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="admin-field md:col-span-2">
              <span className="admin-kpi__label">Store address</span>
              <textarea className="admin-input min-h-[88px]" value={draft.contact.address} onChange={(e) => setDraft((p) => ({ ...p, contact: { ...p.contact, address: e.target.value }, store: { ...p.store, address: e.target.value } }))} />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">Phone</span>
              <input className="admin-input" value={draft.contact.phone} onChange={(e) => setDraft((p) => ({ ...p, contact: { ...p.contact, phone: e.target.value }, store: { ...p.store, phone: e.target.value } }))} />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">Email</span>
              <input className="admin-input" value={draft.contact.email} onChange={(e) => setDraft((p) => ({ ...p, contact: { ...p.contact, email: e.target.value }, store: { ...p.store, email: e.target.value } }))} />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">WhatsApp number</span>
              <input className="admin-input" value={draft.contact.whatsapp} onChange={(e) => setDraft((p) => ({ ...p, contact: { ...p.contact, whatsapp: e.target.value } }))} />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">Store card label</span>
              <input className="admin-input" value={draft.branding.storeLabel} onChange={(e) => setDraft((p) => ({ ...p, branding: { ...p.branding, storeLabel: e.target.value } }))} />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">Instagram URL</span>
              <input className="admin-input" value={draft.social.instagram} onChange={(e) => setDraft((p) => ({ ...p, social: { ...p.social, instagram: e.target.value } }))} />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">Facebook URL</span>
              <input className="admin-input" value={draft.social.facebook} onChange={(e) => setDraft((p) => ({ ...p, social: { ...p.social, facebook: e.target.value } }))} />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">TikTok URL</span>
              <input className="admin-input" value={draft.social.tiktok} onChange={(e) => setDraft((p) => ({ ...p, social: { ...p.social, tiktok: e.target.value } }))} />
            </label>
          </div>
          <AdminButton variant="gold" className="mt-4" loading={updateSettings.isPending} onClick={() => save({ contact: draft.contact, social: draft.social, store: draft.store, branding: draft.branding }, 'Contact & location')}>
            Save location
          </AdminButton>
        </section>
      ) : null}

      {tab === 'navigation' ? (
        <>
          <MobileVisibilityList
            rows={draft.navigation.headerNav.map((item, index) => {
              const catalogBlocked = isHrefBlockedByCatalogChannels(item.href, draft.catalogChannels)
              return {
                id: `nav-${index}`,
                title: item.label || 'Untitled link',
                sub: catalogBlocked ? `${item.href || '—'} · blocked by Catalog` : item.href || '—',
                visible: !item.hidden && !catalogBlocked,
                ...(catalogBlocked ? { disabled: true, stateLabel: 'CATALOG BLOCKED' } : {}),
                onToggle: () => toggleNavVisibility(index),
              }
            })}
            loading={updateSettings.isPending}
            empty="No header menu links yet."
          />

          <div className="menu-control-full-panel">
          <section className="menu-link-editor">
            <div className="menu-link-editor__head">
              <span className="menu-link-editor__eyebrow">STOREFRONT HEADER</span>
              <div>
                <h3>Header links</h3>
                <p>Labels and URLs save together. Visibility and order publish immediately after server read-back.</p>
              </div>
              <span className="menu-link-editor__summary">
                {liveHeaderLinks} live · {draft.navigation.headerNav.length - liveHeaderLinks} not live
              </span>
            </div>
            <div className="menu-link-editor__columns" aria-hidden>
              <span>Order</span>
              <span>Label</span>
              <span>Destination</span>
              <span>State</span>
              <span>Actions</span>
            </div>
            <div className="menu-link-editor__rows">
              {draft.navigation.headerNav.map((item, index) => (
                <div
                  key={`nav-${index}`}
                  className={
                    item.hidden || isHrefBlockedByCatalogChannels(item.href, draft.catalogChannels)
                      ? 'menu-link-row is-hidden'
                      : 'menu-link-row'
                  }
                >
                  <span className="menu-link-row__order">
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <button
                      type="button"
                      aria-label={`Move ${item.label || `link ${index + 1}`} up`}
                      disabled={updateSettings.isPending || index === 0}
                      onClick={() => moveNavItem(index, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${item.label || `link ${index + 1}`} down`}
                      disabled={updateSettings.isPending || index === draft.navigation.headerNav.length - 1}
                      onClick={() => moveNavItem(index, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </span>
                  <label>
                    <span>Label</span>
                    <input
                      className="admin-input"
                      placeholder="Menu label"
                      value={item.label}
                      aria-invalid={!item.label.trim()}
                      onChange={(event) => updateNavItem(index, { label: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>Destination</span>
                    <input
                      className="admin-input"
                      placeholder="/shop"
                      value={item.href}
                      aria-invalid={!item.href.trim()}
                      onChange={(event) => updateNavItem(index, { href: event.target.value })}
                    />
                  </label>
                  <span
                    className={
                      item.hidden || isHrefBlockedByCatalogChannels(item.href, draft.catalogChannels)
                        ? 'menu-state menu-state--hidden'
                        : 'menu-state menu-state--live'
                    }
                  >
                    {item.hidden
                      ? 'HIDDEN'
                      : isHrefBlockedByCatalogChannels(item.href, draft.catalogChannels)
                        ? 'CATALOG BLOCKED'
                        : 'LIVE'}
                  </span>
                  <span className="menu-link-row__actions">
                    <AdminButton
                      variant="ghost"
                      size="sm"
                      loading={updateSettings.isPending}
                      onClick={() => toggleNavVisibility(index)}
                    >
                      {item.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {item.hidden ? 'Show' : 'Hide'}
                    </AdminButton>
                    <AdminButton
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${item.label || `link ${index + 1}`}`}
                      onClick={() => removeNavItem(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </AdminButton>
                  </span>
                </div>
              ))}
            </div>
            <div className="menu-link-editor__savebar">
              <AdminButton
                disabled={draft.navigation.headerNav.length >= 20}
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    navigation: {
                      ...prev.navigation,
                      headerNav: [...prev.navigation.headerNav, { label: '', href: '/' }],
                    },
                  }))
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Add header link
              </AdminButton>
              <span>
                {JSON.stringify(draft.navigation.headerNav) ===
                JSON.stringify(apiData?.navigation.headerNav ?? [])
                  ? 'All header link changes saved'
                  : 'Unsaved label, URL, add, or remove changes'}
              </span>
              <AdminButton
                variant="gold"
                loading={updateSettings.isPending}
                disabled={
                  JSON.stringify(draft.navigation.headerNav) ===
                  JSON.stringify(apiData?.navigation.headerNav ?? [])
                }
                onClick={saveHeaderNav}
              >
                Save links
              </AdminButton>
            </div>
          </section>

          <MenuBuilderPanel
            menuOverrides={draft.menuOverrides ?? { autoSync: true, departments: [] }}
            persistedOverrides={apiData?.menuOverrides ?? { autoSync: true, departments: [] }}
            catalogChannels={draft.catalogChannels}
            headerNav={draft.navigation.headerNav}
            onChange={(menuOverrides) => setDraft((p) => ({ ...p, menuOverrides }))}
            onSave={(overrides, label) => {
              const next = overrides ?? draft.menuOverrides ?? { autoSync: true, departments: [] }
              save({ menuOverrides: next }, label ?? 'Menu builder')
            }}
            saving={updateSettings.isPending}
          />
          </div>
        </>
      ) : null}

      {tab === 'catalog' ? (
        <CatalogVisibilityPanel
          channels={draft.catalogChannels}
          {...(apiData?.catalogChannels ? { savedChannels: apiData.catalogChannels } : {})}
          storefrontUrl={apiData?.store.domain ? `https://${apiData.store.domain.replace(/^https?:\/\//, '')}` : SPLARO_DOMAINS.site}
          onChange={(catalogChannels) => setDraft((prev) => ({ ...prev, catalogChannels }))}
          onSave={(channels) =>
            save({ catalogChannels: channels ?? draft.catalogChannels }, 'Catalog visibility')
          }
          saving={updateSettings.isPending}
        />
      ) : null}

      {tab === 'shopFilters' ? (
        <ShopFiltersPanel
          filters={draft.shopFilters}
          {...(apiData?.shopFilters ? { savedFilters: mergeShopFilters(apiData.shopFilters) } : {})}
          onChange={(shopFilters) => setDraft((prev) => ({ ...prev, shopFilters }))}
          onSave={() => save({ shopFilters: draft.shopFilters }, 'Shop filters')}
          saving={updateSettings.isPending}
        />
      ) : null}

      {tab === 'footer' ? (
        <section className="admin-module-card storefront-footer-editor">
          <div className="storefront-footer-editor__heading">
            <span className="storefront-footer-editor__heading-icon">
              <Link2 className="h-4 w-4" />
            </span>
            <span className="storefront-footer-editor__heading-copy">
              <h3 className="admin-module-card__title">Footer link groups</h3>
              <span>Organise storefront footer labels and destinations.</span>
            </span>
            <span className="storefront-footer-editor__summary">
              {draft.navigation.footerGroups.length} groups ·{' '}
              {draft.navigation.footerGroups.reduce((total, group) => total + group.links.length, 0)} links
            </span>
          </div>

          <div className="storefront-footer-editor__grid">
            {draft.navigation.footerGroups.map((group, groupIndex) => (
              <article key={group.id} className="storefront-footer-editor__group">
                <div className="storefront-footer-editor__group-head">
                  <span className="storefront-footer-editor__group-index">
                    {String(groupIndex + 1).padStart(2, '0')}
                  </span>
                  <label className="storefront-footer-editor__group-title">
                    <span>Group name</span>
                    <input
                      className="admin-input"
                      value={group.title}
                      onChange={(e) => updateFooterGroup(groupIndex, { title: e.target.value })}
                    />
                  </label>
                  <span className="storefront-footer-editor__count">
                    {group.links.length} {group.links.length === 1 ? 'link' : 'links'}
                  </span>
                </div>

                <div className="storefront-footer-editor__links">
                  {group.links.map((link, linkIndex) => (
                    <div key={`${group.id}-${linkIndex}`} className="storefront-footer-editor__link-row">
                      <label>
                        <span>Label</span>
                        <input
                          className="admin-input"
                          value={link.label}
                          onChange={(e) => {
                            const links = group.links.map((item, i) =>
                              i === linkIndex ? { ...item, label: e.target.value } : item,
                            )
                            updateFooterGroup(groupIndex, { links })
                          }}
                        />
                      </label>
                      <label>
                        <span>Destination</span>
                        <input
                          className="admin-input storefront-footer-editor__href"
                          value={link.href}
                          onChange={(e) => {
                            const links = group.links.map((item, i) =>
                              i === linkIndex ? { ...item, href: e.target.value } : item,
                            )
                            updateFooterGroup(groupIndex, { links })
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="storefront-footer-editor__remove"
                        title={`Remove ${link.label || 'link'}`}
                        aria-label={`Remove ${link.label || 'link'}`}
                        onClick={() =>
                          updateFooterGroup(groupIndex, {
                            links: group.links.filter((_, i) => i !== linkIndex),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="storefront-footer-editor__add"
                  onClick={() =>
                    updateFooterGroup(groupIndex, {
                      links: [...group.links, { label: 'New link', href: '/' }],
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add link
                </button>
              </article>
            ))}
          </div>

          <div className="storefront-footer-editor__savebar">
            <span>Changes stay draft until saved.</span>
            <AdminButton
              variant="gold"
              loading={updateSettings.isPending}
              onClick={() => save({ navigation: draft.navigation }, 'Footer links')}
            >
              Save footer
            </AdminButton>
          </div>
        </section>
      ) : null}

      {tab === 'marquee' ? (
        <section className="admin-module-card">
          <label className="admin-check-row mb-4">
            <span className="text-sm font-semibold">Show marquee strip on homepage</span>
            <input type="checkbox" checked={draft.marquee.enabled} onChange={() => setDraft((p) => ({ ...p, marquee: { ...p.marquee, enabled: !p.marquee.enabled } }))} className="h-4 w-4 accent-[var(--admin-color-accent-blue)]" />
          </label>
          <p className="admin-module-card__text mb-3">One line per scrolling message. Leave empty when disabled.</p>
          <textarea
            className="admin-input min-h-[140px]"
            value={draft.marquee.items.join('\n')}
            onChange={(e) => setDraft((p) => ({ ...p, marquee: { ...p.marquee, items: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) } }))}
            placeholder="Summer Collection — Now Live&#10;bKash · Nagad · COD"
          />
          <AdminButton variant="gold" className="mt-4" loading={updateSettings.isPending} onClick={() => save({ marquee: draft.marquee }, 'Marquee')}>
            Save marquee
          </AdminButton>
        </section>
      ) : null}

      {tab === 'offers' ? (
        <section className="admin-module-card admin-module-card--accent">
          <label className="admin-check-row mb-4">
            <span className="text-sm font-semibold text-[var(--admin-c-1c1c22)]">Show homepage offer section</span>
            <input type="checkbox" checked={draft.specialOffer.enabled} onChange={() => setDraft((p) => ({ ...p, specialOffer: { ...p.specialOffer, enabled: !p.specialOffer.enabled } }))} className="h-4 w-4 accent-[var(--admin-color-accent-blue)]" />
          </label>
          <p className="admin-module-card__subtitle mb-4">Pick a template, fill content, then save. Nothing shows until enabled.</p>
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            {OFFER_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setDraft((p) => ({ ...p, specialOffer: { ...p.specialOffer, template: template.id } }))}
                className={cn(
                  'admin-choice-card',
                  draft.specialOffer.template === template.id && 'admin-choice-card--active',
                )}
              >
                <p className="admin-choice-card__title">{template.label}</p>
                <p className="admin-choice-card__hint">{template.hint}</p>
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="admin-field md:col-span-2">
              <span className="admin-kpi__label">Offer title</span>
              <input className="admin-input" value={draft.specialOffer.title} onChange={(e) => setDraft((p) => ({ ...p, specialOffer: { ...p.specialOffer, title: e.target.value } }))} />
            </label>
            <label className="admin-field md:col-span-2">
              <span className="admin-kpi__label">Subtitle</span>
              <input className="admin-input" value={draft.specialOffer.subtitle ?? ''} onChange={(e) => setDraft((p) => ({ ...p, specialOffer: { ...p.specialOffer, subtitle: e.target.value } }))} />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">Badge text</span>
              <input className="admin-input" value={draft.specialOffer.badge ?? ''} onChange={(e) => setDraft((p) => ({ ...p, specialOffer: { ...p.specialOffer, badge: e.target.value } }))} />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">Discount label</span>
              <input className="admin-input" placeholder="30% OFF" value={draft.specialOffer.discountLabel ?? ''} onChange={(e) => setDraft((p) => ({ ...p, specialOffer: { ...p.specialOffer, discountLabel: e.target.value } }))} />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">Button label</span>
              <input className="admin-input" value={draft.specialOffer.ctaLabel ?? 'Shop now'} onChange={(e) => setDraft((p) => ({ ...p, specialOffer: { ...p.specialOffer, ctaLabel: e.target.value } }))} />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">Button link</span>
              <input className="admin-input" value={draft.specialOffer.ctaHref ?? '/shop'} onChange={(e) => setDraft((p) => ({ ...p, specialOffer: { ...p.specialOffer, ctaHref: e.target.value } }))} />
            </label>
            <label className="admin-field md:col-span-2">
              <span className="admin-kpi__label">Ends at (for countdown template)</span>
              <input type="datetime-local" className="admin-input" value={draft.specialOffer.endsAt?.slice(0, 16) ?? ''} onChange={(e) => setDraft((p) => ({ ...p, specialOffer: { ...p.specialOffer, endsAt: e.target.value ? new Date(e.target.value).toISOString() : null } }))} />
            </label>
          </div>
          <AdminButton variant="gold" className="mt-4" loading={updateSettings.isPending} onClick={() => save({ specialOffer: draft.specialOffer }, 'Homepage offer')}>
            Save offer
          </AdminButton>
        </section>
      ) : null}

      {tab === 'homepage' ? (
        <>
          <MobileVisibilityList
            rows={MOBILE_HOMEPAGE_SECTIONS.map((section) => ({
              id: section.key,
              title: section.title,
              sub: section.sub,
              visible: Boolean(draft.homepage[section.key]),
              onToggle: () => toggleHomepageSection(section.key),
            }))}
            loading={updateSettings.isPending}
            empty="No homepage sections configured."
          />
          <div className="dc-desktop-route-panel">
            <HomepageVisibilityPanel
              draft={draft}
              setDraft={setDraft}
              onSave={save}
              saving={updateSettings.isPending}
            />
          </div>
        </>
      ) : null}

      {tab === 'story' ? (
        <OurStoryAdminPanel
          draft={draft}
          setDraft={setDraft}
          onSave={save}
          saving={updateSettings.isPending}
        />
      ) : null}

      {tab === 'newsletter' ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]">
          <section className="admin-module-card admin-module-card--accent space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="admin-module-card__title">Homepage newsletter</p>
                <p className="admin-module-card__text mt-1">Copy, perks, and signup shell above the footer.</p>
              </div>
              <label className="admin-check-row shrink-0">
                <span className="text-sm font-semibold">Show section</span>
                <input
                  type="checkbox"
                  checked={draft.newsletter.enabled}
                  onChange={() => setDraft((p) => ({ ...p, newsletter: { ...p.newsletter, enabled: !p.newsletter.enabled } }))}
                  className="h-4 w-4 accent-[var(--admin-color-accent-blue)]"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="admin-field">
                <span className="admin-kpi__label">Eyebrow</span>
                <input className="admin-input" value={draft.newsletter.eyebrow} onChange={(e) => setDraft((p) => ({ ...p, newsletter: { ...p.newsletter, eyebrow: e.target.value } }))} />
              </label>
              <label className="admin-field">
                <span className="admin-kpi__label">Button label</span>
                <input className="admin-input" value={draft.newsletter.buttonLabel} onChange={(e) => setDraft((p) => ({ ...p, newsletter: { ...p.newsletter, buttonLabel: e.target.value } }))} />
              </label>
              <label className="admin-field md:col-span-2">
                <span className="admin-kpi__label">Headline</span>
                <input className="admin-input" value={draft.newsletter.title} onChange={(e) => setDraft((p) => ({ ...p, newsletter: { ...p.newsletter, title: e.target.value } }))} />
              </label>
              <label className="admin-field md:col-span-2">
                <span className="admin-kpi__label">Subtitle</span>
                <textarea
                  className="admin-input min-h-[88px] resize-none"
                  value={draft.newsletter.subtitle}
                  onChange={(e) => setDraft((p) => ({ ...p, newsletter: { ...p.newsletter, subtitle: e.target.value } }))}
                />
              </label>
              <label className="admin-field">
                <span className="admin-kpi__label">Email placeholder</span>
                <input className="admin-input" value={draft.newsletter.placeholder} onChange={(e) => setDraft((p) => ({ ...p, newsletter: { ...p.newsletter, placeholder: e.target.value } }))} />
              </label>
              <label className="admin-field">
                <span className="admin-kpi__label">Footer note</span>
                <input className="admin-input" value={draft.newsletter.note} onChange={(e) => setDraft((p) => ({ ...p, newsletter: { ...p.newsletter, note: e.target.value } }))} />
              </label>
              <label className="admin-field md:col-span-2">
                <span className="admin-kpi__label">Perk chips (one per line)</span>
                <textarea
                  className="admin-input min-h-[96px] resize-none"
                  value={draft.newsletter.perks.join('\n')}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      newsletter: {
                        ...p.newsletter,
                        perks: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean),
                      },
                    }))
                  }
                  placeholder={'Early access to drops\nMember-only offers'}
                />
              </label>
            </div>

            <AdminButton
              variant="gold"
              loading={updateSettings.isPending}
              onClick={() =>
                save({ newsletter: draft.newsletter }, 'Newsletter section', () => void refetchSubscribers())
              }
            >
              Save newsletter
            </AdminButton>
          </section>

          <NewsletterAdminPreview config={draft.newsletter} />
        </div>
      ) : null}

      {tab === 'newsletter' ? (
        <section className="admin-module-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="admin-module-card__title">Subscribers</p>
              <p className="admin-module-card__text mt-1">
                {subscriberData?.total ?? '…'} active signups from the homepage form.
              </p>
            </div>
            <AdminButton variant="ghost" onClick={() => void refetchSubscribers()}>
              Refresh
            </AdminButton>
          </div>
          {!subscriberData?.subscribers?.length ? (
            <p className="text-sm font-semibold text-[var(--admin-color-neutral-500)]">No subscribers yet — first signup will appear here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-module-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriberData.subscribers.map((row) => (
                    <tr key={row.id}>
                      <td className="font-semibold">{row.email}</td>
                      <td>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-800">
                          {row.status}
                        </span>
                      </td>
                      <td className="muted text-xs">{new Date(row.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === 'shipping' ? (
        <section className="admin-module-card">
          <h3 className="admin-module-card__title mb-4">Shipping & payments</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="admin-field">
              <span className="admin-kpi__label">Free shipping from (৳) — 0 = off</span>
              <input className="admin-input" value={draft.shipping.freeShippingMin} onChange={(e) => setDraft((p) => ({ ...p, shipping: { ...p.shipping, freeShippingMin: e.target.value } }))} />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">Dhaka delivery (৳)</span>
              <input className="admin-input" value={draft.shipping.dhakaDeliveryCharge ?? 60} onChange={(e) => setDraft((p) => ({ ...p, shipping: { ...p.shipping, dhakaDeliveryCharge: Number(e.target.value) } }))} />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">Outside Dhaka (৳)</span>
              <input className="admin-input" value={draft.shipping.outsideDhakaCharge ?? 120} onChange={(e) => setDraft((p) => ({ ...p, shipping: { ...p.shipping, outsideDhakaCharge: Number(e.target.value) } }))} />
            </label>
          </div>
          <div className="mt-4 space-y-2">
            {(['cod', 'bkash', 'nagad', 'sslcommerz'] as const).map((key) => (
              <label key={key} className="admin-check-row">
                <span className="text-sm font-semibold capitalize">{key === 'sslcommerz' ? 'SSLCommerz / Card' : key}</span>
                <input type="checkbox" checked={draft.payments[key] ?? false} onChange={() => setDraft((p) => ({ ...p, payments: { ...p.payments, [key]: !p.payments[key] } }))} className="h-4 w-4 accent-[var(--admin-color-accent-blue)]" />
              </label>
            ))}
          </div>
          <AdminButton variant="gold" className="mt-4" loading={updateSettings.isPending} onClick={() => save({ shipping: draft.shipping, payments: draft.payments }, 'Shipping & payments')}>
            Save shipping
          </AdminButton>
        </section>
      ) : null}

      {tab === 'smtp' ? (
        <section className="admin-module-card admin-module-card--accent">
          <h3 className="admin-module-card__title">SMTP & transactional email</h3>
          <p className="admin-module-card__subtitle mb-4">
            Order confirmations, password reset and admin alerts use these settings. Leave password blank to keep the current one.
          </p>
          <label className="admin-check-row mb-4">
            <span className="text-sm font-semibold text-[var(--admin-c-1c1c22)]">Enable outbound email</span>
            <input
              type="checkbox"
              checked={draft.emailEnabled}
              onChange={() => setDraft((p) => ({ ...p, emailEnabled: !p.emailEnabled, smtp: { ...p.smtp, enabled: !p.emailEnabled } }))}
              className="h-4 w-4 accent-[var(--admin-color-accent-blue)]"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="admin-field">
              <span className="admin-kpi__label">SMTP host</span>
              <input className="admin-input" placeholder="smtp.gmail.com" value={draft.smtp.host} onChange={(e) => setDraft((p) => ({ ...p, smtp: { ...p.smtp, host: e.target.value } }))} />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">Port</span>
              <input className="admin-input" type="number" value={draft.smtp.port} onChange={(e) => setDraft((p) => ({ ...p, smtp: { ...p.smtp, port: Number(e.target.value) || 587 } }))} />
            </label>
            <label className="admin-check-row md:col-span-2">
              <span className="text-sm font-semibold text-[var(--admin-c-1c1c22)]">Use SSL/TLS (port 465)</span>
              <input type="checkbox" checked={draft.smtp.secure} onChange={() => setDraft((p) => ({ ...p, smtp: { ...p.smtp, secure: !p.smtp.secure } }))} className="h-4 w-4 accent-[var(--admin-color-accent-blue)]" />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">Username</span>
              <input className="admin-input" autoComplete="off" value={draft.smtp.user} onChange={(e) => setDraft((p) => ({ ...p, smtp: { ...p.smtp, user: e.target.value } }))} />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">Password / app password</span>
              <input className="admin-input" type="password" autoComplete="new-password" placeholder="••••••••" value={draft.smtp.password} onChange={(e) => setDraft((p) => ({ ...p, smtp: { ...p.smtp, password: e.target.value } }))} />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">From name</span>
              <input className="admin-input" value={draft.smtp.fromName} onChange={(e) => setDraft((p) => ({ ...p, smtp: { ...p.smtp, fromName: e.target.value } }))} />
            </label>
            <label className="admin-field">
              <span className="admin-kpi__label">From email</span>
              <input className="admin-input" type="email" placeholder="noreply@splaro.co" value={draft.smtp.fromEmail} onChange={(e) => setDraft((p) => ({ ...p, smtp: { ...p.smtp, fromEmail: e.target.value } }))} />
            </label>
            <label className="admin-field md:col-span-2">
              <span className="admin-kpi__label">Reply-to (optional)</span>
              <input className="admin-input" type="email" placeholder="support@splaro.co" value={draft.smtp.replyTo ?? ''} onChange={(e) => setDraft((p) => ({ ...p, smtp: { ...p.smtp, replyTo: e.target.value } }))} />
            </label>
          </div>
          <AdminButton
            variant="gold"
            className="mt-4"
            loading={updateSettings.isPending}
            onClick={() => {
              const { password, ...rest } = draft.smtp
              const smtpPayload = password ? draft.smtp : rest
              save({ smtp: smtpPayload as typeof draft.smtp, emailEnabled: draft.emailEnabled }, 'SMTP settings')
            }}
          >
            Save SMTP
          </AdminButton>
        </section>
      ) : null}
      </div>
    </div>
  )
}

export function SettingsPanel() {
  return <StorefrontControlPanel initialTab="brand" />
}

export function MenuControlPanel() {
  return <StorefrontControlPanel initialTab="navigation" />
}

export function HomePageControlPanel() {
  return <StorefrontControlPanel initialTab="homepage" />
}

function MobileVisibilityList({
  rows,
  loading,
  empty,
}: {
  rows: Array<{
    id: string
    title: string
    sub: string
    visible: boolean
    disabled?: boolean
    stateLabel?: string
    onToggle: () => void
  }>
  loading: boolean
  empty: string
}) {
  return (
    <div className="dc-mobile-route-panel" aria-label="Mobile storefront controls">
      {rows.length === 0 ? (
        <div
          style={{
            padding: '42px 18px',
            border: '1px solid var(--line)',
            borderRadius: 12,
            background: 'var(--surface)',
            color: 'var(--ink-3)',
            textAlign: 'center',
          }}
        >
          {empty}
        </div>
      ) : (
        <div className="dc-mobile-list">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              className="dc-mobile-list-card"
              disabled={loading || row.disabled}
              onClick={row.onToggle}
              aria-label={`${row.visible ? 'Hide' : 'Show'} ${row.title}`}
            >
              <span
                className="dc-mobile-list-card__icon"
                style={{
                  background: row.visible ? 'var(--ok-soft)' : 'var(--surface-2)',
                  color: row.visible ? 'var(--ok)' : 'var(--ink-3)',
                }}
              >
                {row.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </span>
              <span className="dc-mobile-list-card__copy">
                <span className="dc-mobile-list-card__title">{row.title}</span>
                <span className="dc-mobile-list-card__sub">{row.sub}</span>
              </span>
              <span
                className="dc-mobile-list-card__value"
                style={{ color: row.visible ? 'var(--ok)' : 'var(--ink-3)' }}
              >
                {loading ? 'SAVING…' : row.stateLabel ?? (row.visible ? 'VISIBLE' : 'HIDDEN')}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Homepage Our Story / platinum story-deck CMS */
export function OurStoryControlPanel() {
  return <StorefrontControlPanel initialTab="story" />
}
