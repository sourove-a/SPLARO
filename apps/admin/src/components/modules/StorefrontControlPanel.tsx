'use client'

import { useEffect, useState } from 'react'
import {
  Eye,
  BookOpen,
  Home,
  Inbox,
  LayoutGrid,
  Mail,
  MapPin,
  Megaphone,
  Menu,
  SlidersHorizontal,
  Sparkles,
  Store,
  Truck,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { CatalogVisibilityPanel } from '@/components/modules/CatalogVisibilityPanel'
import { MenuBuilderPanel } from '@/components/modules/MenuBuilderPanel'
import { ShopFiltersPanel } from '@/components/modules/ShopFiltersPanel'
import { HomepageVisibilityPanel } from '@/components/modules/HomepageVisibilityPanel'
import { NewsletterAdminPreview } from '@/components/modules/NewsletterAdminPreview'
import { OurStoryAdminPanel } from '@/components/modules/OurStoryAdminPanel'
import { toastApiSaved, toastFail } from '@/lib/admin/feedback'
import { verifySettingsApplied } from '@/lib/admin/settings-save'
import { DEFAULT_HOMEPAGE_SECTIONS, DEFAULT_OUR_STORY } from '@/lib/storefront/homepage-defaults'
import { DEFAULT_CATALOG_CHANNELS, DEFAULT_SHOP_FILTERS, mergeShopFilters } from '@splaro/types'
import { SPLARO_DOMAINS } from '@splaro/config'
import { useNewsletterSubscribers, useSettings, useUpdateSettings } from '@/lib/api/hooks'
import type { AdminSettingsData, FooterGroup, NavLink } from '@/lib/api/settings'
import { cn } from '@/lib/utils/cn'

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

  useEffect(() => {
    if (apiData) {
      setDraft({
        ...EMPTY_SETTINGS,
        ...apiData,
        smtp: { ...EMPTY_SETTINGS.smtp, ...(apiData.smtp ?? {}) },
        newsletter: { ...EMPTY_SETTINGS.newsletter, ...(apiData.newsletter ?? {}) },
        ourStory: { ...DEFAULT_OUR_STORY, ...(apiData.ourStory ?? {}), customerStories: { ...DEFAULT_OUR_STORY.customerStories, ...(apiData.ourStory?.customerStories ?? {}), stories: apiData.ourStory?.customerStories?.stories?.length ? apiData.ourStory.customerStories.stories : DEFAULT_OUR_STORY.customerStories.stories }, pillars: apiData.ourStory?.pillars?.length ? apiData.ourStory.pillars : DEFAULT_OUR_STORY.pillars },
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

  if (isLoading && !apiData) {
    return <p className="text-sm font-semibold text-[#6B6B6B]">Loading storefront settings…</p>
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

  return (
    <div className="space-y-5">
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
          <section className="admin-module-card">
            <h3 className="admin-module-card__title mb-2">Header menu links</h3>
            <p className="admin-module-card__text mb-4">Top-level navigation labels and URLs.</p>
            <div className="space-y-3">
              {draft.navigation.headerNav.map((item, index) => (
                <div key={`nav-${index}`} className="grid gap-2 rounded-[14px] border border-black/6 bg-white/70 p-3 md:grid-cols-[1fr_1fr_auto]">
                  <input className="admin-input" placeholder="Label" value={item.label} onChange={(e) => updateNavItem(index, { label: e.target.value })} />
                  <input className="admin-input" placeholder="/shop" value={item.href} onChange={(e) => updateNavItem(index, { href: e.target.value })} />
                  <AdminButton variant="ghost" onClick={() => setDraft((p) => ({ ...p, navigation: { ...p.navigation, headerNav: p.navigation.headerNav.filter((_, i) => i !== index) } }))}>
                    Remove
                  </AdminButton>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <AdminButton onClick={() => setDraft((p) => ({ ...p, navigation: { ...p.navigation, headerNav: [...p.navigation.headerNav, { label: 'New link', href: '/' }] } }))}>
                Add menu item
              </AdminButton>
              <AdminButton variant="gold" loading={updateSettings.isPending} onClick={() => save({ navigation: draft.navigation }, 'Header menu')}>
                Save links
              </AdminButton>
            </div>
          </section>

          <MenuBuilderPanel
            menuOverrides={draft.menuOverrides ?? { autoSync: true, departments: [] }}
            onChange={(menuOverrides) => setDraft((p) => ({ ...p, menuOverrides }))}
            onSave={() => {
              const overrides = draft.menuOverrides ?? { autoSync: true, departments: [] }
              save({ menuOverrides: overrides }, 'Menu builder')
            }}
            saving={updateSettings.isPending}
          />
        </>
      ) : null}

      {tab === 'catalog' ? (
        <CatalogVisibilityPanel
          channels={draft.catalogChannels}
          {...(apiData?.catalogChannels ? { savedChannels: apiData.catalogChannels } : {})}
          storefrontUrl={apiData?.store.domain ? `https://${apiData.store.domain.replace(/^https?:\/\//, '')}` : SPLARO_DOMAINS.site}
          onChange={(catalogChannels) => setDraft((prev) => ({ ...prev, catalogChannels }))}
          onSave={() => save({ catalogChannels: draft.catalogChannels }, 'Catalog visibility')}
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
        <section className="admin-module-card">
          <h3 className="admin-module-card__title mb-4">Footer link groups</h3>
          <div className="space-y-5">
            {draft.navigation.footerGroups.map((group, groupIndex) => (
              <div key={group.id} className="rounded-[16px] border border-black/6 bg-white/70 p-4">
                <input className="admin-input mb-3 font-bold" value={group.title} onChange={(e) => updateFooterGroup(groupIndex, { title: e.target.value })} />
                <div className="space-y-2">
                  {group.links.map((link, linkIndex) => (
                    <div key={`${group.id}-${linkIndex}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                      <input className="admin-input" value={link.label} onChange={(e) => {
                        const links = group.links.map((l, i) => (i === linkIndex ? { ...l, label: e.target.value } : l))
                        updateFooterGroup(groupIndex, { links })
                      }} />
                      <input className="admin-input" value={link.href} onChange={(e) => {
                        const links = group.links.map((l, i) => (i === linkIndex ? { ...l, href: e.target.value } : l))
                        updateFooterGroup(groupIndex, { links })
                      }} />
                      <AdminButton variant="ghost" onClick={() => updateFooterGroup(groupIndex, { links: group.links.filter((_, i) => i !== linkIndex) })}>
                        Remove
                      </AdminButton>
                    </div>
                  ))}
                </div>
                <AdminButton className="mt-2" onClick={() => updateFooterGroup(groupIndex, { links: [...group.links, { label: 'New link', href: '/' }] })}>
                  Add link
                </AdminButton>
              </div>
            ))}
          </div>
          <AdminButton variant="gold" className="mt-4" loading={updateSettings.isPending} onClick={() => save({ navigation: draft.navigation }, 'Footer links')}>
            Save footer
          </AdminButton>
        </section>
      ) : null}

      {tab === 'marquee' ? (
        <section className="admin-module-card">
          <label className="admin-check-row mb-4">
            <span className="text-sm font-semibold">Show marquee strip on homepage</span>
            <input type="checkbox" checked={draft.marquee.enabled} onChange={() => setDraft((p) => ({ ...p, marquee: { ...p.marquee, enabled: !p.marquee.enabled } }))} className="h-4 w-4 accent-[#5E7CFF]" />
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
            <span className="text-sm font-semibold text-[#1c1c22]">Show homepage offer section</span>
            <input type="checkbox" checked={draft.specialOffer.enabled} onChange={() => setDraft((p) => ({ ...p, specialOffer: { ...p.specialOffer, enabled: !p.specialOffer.enabled } }))} className="h-4 w-4 accent-[#5E7CFF]" />
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
        <HomepageVisibilityPanel
          draft={draft}
          setDraft={setDraft}
          onSave={save}
          saving={updateSettings.isPending}
        />
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
                  className="h-4 w-4 accent-[#5E7CFF]"
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
            <p className="text-sm font-semibold text-[#6B6B6B]">No subscribers yet — first signup will appear here.</p>
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
                <input type="checkbox" checked={draft.payments[key] ?? false} onChange={() => setDraft((p) => ({ ...p, payments: { ...p.payments, [key]: !p.payments[key] } }))} className="h-4 w-4 accent-[#5E7CFF]" />
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
            <span className="text-sm font-semibold text-[#1c1c22]">Enable outbound email</span>
            <input
              type="checkbox"
              checked={draft.emailEnabled}
              onChange={() => setDraft((p) => ({ ...p, emailEnabled: !p.emailEnabled, smtp: { ...p.smtp, enabled: !p.emailEnabled } }))}
              className="h-4 w-4 accent-[#5E7CFF]"
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
              <span className="text-sm font-semibold text-[#1c1c22]">Use SSL/TLS (port 465)</span>
              <input type="checkbox" checked={draft.smtp.secure} onChange={() => setDraft((p) => ({ ...p, smtp: { ...p.smtp, secure: !p.smtp.secure } }))} className="h-4 w-4 accent-[#5E7CFF]" />
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
  )
}

export function SettingsPanel() {
  return <StorefrontControlPanel initialTab="brand" />
}

export function MenuControlPanel() {
  return <StorefrontControlPanel initialTab="navigation" />
}

export function HomePageControlPanel() {
  return <StorefrontControlPanel initialTab="offers" />
}
