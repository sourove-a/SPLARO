'use client'

import { useRouter } from 'next/navigation'
import { useMemo } from 'react'

import { DcIcon } from './DcIcon'
import { DcPageHead } from './DcPageHead'
import { DcScreenProvider } from './DcScreenContext'
import { dcPageStatus } from './page-status'
import { FONT, MONO, formatTaka, statusToneStyle } from './tokens'
import type { HomepageSectionsConfig } from '@/lib/api/settings'
import { useCollections, useDashboardStats, useOrders, useSettings } from '@/lib/api/hooks'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

interface PhoneCard {
  title: string
  sub: string
  value: string
  valueColor?: string
  icon: string
  iconBg: string
  iconFg: string
}

interface PhoneTab {
  id: string
  label: string
  icon: string
}

const TABS: PhoneTab[] = [
  { id: 'home', label: 'Today', icon: 'icon-layout-dashboard' },
  { id: 'orders', label: 'Orders', icon: 'icon-shopping-bag' },
  { id: 'ops', label: 'Pack', icon: 'icon-scan-line' },
  { id: 'more', label: 'More', icon: 'icon-ellipsis' },
]

const HOMEPAGE_LABELS: Array<{ key: keyof HomepageSectionsConfig; title: string }> = [
  { key: 'hero', title: 'Hero slider' },
  { key: 'marquee', title: 'Marquee strip' },
  { key: 'specialOffer', title: 'Special offer band' },
  { key: 'instagram', title: 'Instagram strip' },
  { key: 'newsletter', title: 'Newsletter block' },
]

/**
 * Phone-layout reference frames. All four pull live admin data — never invent
 * VISIBLE/HIDDEN rows.
 */
export function DcMobileScreens() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="mobile" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcMobileBody />
    </DcScreenProvider>
  )
}

function DcMobileBody() {
  const router = useRouter()
  const stats = useDashboardStats('Today')
  const orders = useOrders({ limit: 6 })
  const settings = useSettings()
  const collections = useCollections()
  const { api } = useAdminConnection(25_000)

  const pageStatus = dcPageStatus([stats, orders, settings, collections], api.pulse)

  const todayCards: PhoneCard[] = useMemo(() => {
    const s = stats.data
    return [
      {
        title: 'Revenue today',
        sub: s
          ? `${s.revenue.change >= 0 ? '+' : ''}${Math.round(s.revenue.change * 10) / 10}% vs yesterday`
          : 'loading',
        value: s ? formatTaka(s.revenue.value) : '—',
        icon: 'icon-banknote',
        iconBg: 'var(--ok-soft)',
        iconFg: 'var(--ok)',
      },
      {
        title: 'Orders today',
        sub: s ? `${s.alerts.codRiskOrders} flagged COD risk` : 'loading',
        value: s ? String(s.orders.value) : '—',
        icon: 'icon-shopping-bag',
        iconBg: 'var(--violet-soft)',
        iconFg: 'var(--violet)',
      },
      {
        title: 'Customers',
        sub: 'new in this window',
        value: s ? String(s.customers.value) : '—',
        icon: 'icon-users',
        iconBg: 'var(--info-soft)',
        iconFg: 'var(--info)',
      },
      {
        title: 'Avg order value',
        sub: 'per checkout today',
        value: s ? formatTaka(s.avgOrderValue.value) : '—',
        icon: 'icon-credit-card',
        iconBg: 'var(--info-soft)',
        iconFg: 'var(--info)',
      },
      {
        title: 'Failed payments',
        sub: 'gateway declined or timed out',
        value: s ? String(s.alerts.failedPayments) : '—',
        valueColor: (s?.alerts.failedPayments ?? 0) > 0 ? 'var(--bad)' : 'var(--ink)',
        icon: 'icon-triangle-alert',
        iconBg: 'var(--bad-soft)',
        iconFg: 'var(--bad)',
      },
    ]
  }, [stats.data])

  const orderCards: PhoneCard[] = useMemo(
    () =>
      (orders.data?.orders ?? []).slice(0, 6).map((o) => {
        const status = o.status.charAt(0) + o.status.slice(1).toLowerCase()
        const tone = statusToneStyle(status)
        return {
          title: `${o.invoiceNumber} · ${o.shippingName}`,
          sub: `${status} · ${o.paymentMethod}`,
          value: formatTaka(Number(o.total)),
          icon: 'icon-shopping-bag',
          iconBg: tone.bg,
          iconFg: tone.fg,
        }
      }),
    [orders.data],
  )

  const menuCards: PhoneCard[] = useMemo(() => {
    const nav = settings.data?.navigation.headerNav ?? []
    const liveCollections = (collections.data?.collections ?? [])
      .filter((c) => c.isActive)
      .slice(0, 4)

    const fromNav = nav.slice(0, 6).map((item) => {
      const hidden = Boolean(item.hidden)
      return {
        title: item.label || 'Untitled link',
        sub: item.href || '—',
        value: hidden ? 'HIDDEN' : 'VISIBLE',
        valueColor: hidden ? 'var(--ink-3)' : 'var(--ok)',
        icon: hidden ? 'icon-eye-off' : 'icon-eye',
        iconBg: hidden ? 'var(--surface-2)' : 'var(--ok-soft)',
        iconFg: hidden ? 'var(--ink-3)' : 'var(--ok)',
      } satisfies PhoneCard
    })

    if (fromNav.length > 0) return fromNav

    return liveCollections.map((c) => ({
      title: c.name,
      sub: `/${c.slug}`,
      value: 'VISIBLE',
      valueColor: 'var(--ok)',
      icon: 'icon-eye',
      iconBg: 'var(--ok-soft)',
      iconFg: 'var(--ok)',
    }))
  }, [settings.data, collections.data])

  const homepageCards: PhoneCard[] = useMemo(() => {
    const data = settings.data
    if (!data) return []

    const hp = data.homepage
    const marqueeCount = data.marquee?.items?.length ?? 0
    const offerTitle = data.specialOffer?.title?.trim() || 'Special offer'
    const offerEnds = data.specialOffer?.endsAt
      ? `ends ${new Date(data.specialOffer.endsAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
        })}`
      : 'no end date'

    return HOMEPAGE_LABELS.map(({ key, title }) => {
      let on = Boolean(hp[key])
      let sub = 'homepage section'
      if (key === 'marquee') {
        on = Boolean(hp.marquee && data.marquee?.enabled)
        sub = data.marquee?.enabled
          ? `${marqueeCount} item${marqueeCount === 1 ? '' : 's'}`
          : 'disabled in settings'
      } else if (key === 'specialOffer') {
        on = Boolean(hp.specialOffer && data.specialOffer?.enabled)
        sub = data.specialOffer?.enabled
          ? `${offerTitle} · ${offerEnds}`
          : 'disabled in settings'
      } else if (key === 'newsletter') {
        on = Boolean(hp.newsletter && data.newsletter?.enabled)
        sub = data.newsletter?.enabled ? 'newsletter block' : 'disabled in settings'
      } else if (key === 'instagram') {
        sub = on ? 'mounted when section is on' : 'off in homepage settings'
      } else if (key === 'hero') {
        sub = on ? 'hero slider' : 'off in homepage settings'
      }

      return {
        title,
        sub,
        value: on ? 'VISIBLE' : 'HIDDEN',
        valueColor: on ? 'var(--ok)' : 'var(--ink-3)',
        icon: on ? 'icon-eye' : 'icon-eye-off',
        iconBg: on ? 'var(--ok-soft)' : 'var(--surface-2)',
        iconFg: on ? 'var(--ok)' : 'var(--ink-3)',
      } satisfies PhoneCard
    })
  }, [settings.data])

  const syncing =
    stats.isFetching || orders.isFetching || settings.isFetching || collections.isFetching

  return (
    <>
      <DcPageHead
        crumbGroup="Overview"
        title="Mobile screens"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          syncing ? 'syncing…' : settings.error ? 'settings offline' : 'live store data'
        }
        syncing={syncing}
        onSync={() => {
          void stats.refetch()
          void orders.refetch()
          void settings.refetch()
          void collections.refetch()
        }}
      />

      <div
        className="dc-mobile-screens-hint"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          padding: '11px 14px',
          borderRadius: 11,
          border: '1px solid var(--info-bd)',
          background: 'var(--info-soft)',
        }}
      >
        <DcIcon name="icon-info" size={15} color="var(--info)" />
        <span
          style={{ flex: 1, font: `500 12.5px/1.5 ${FONT}`, color: 'var(--ink-2)', textWrap: 'pretty' }}
        >
          Desktop design reference — phone frames for layout review. On a real phone, use Today /
          Orders / Pack in the bottom bar (live admin app, not these frames).
        </span>
      </div>

      <div className="dc-mobile-screens-phone-go">
        <p style={{ margin: 0, font: `500 13px/1.45 ${FONT}`, color: 'var(--ink-2)' }}>
          Phone-এ admin এখন app-এর মতো চলে — bottom tab: Today, Orders, Pack.
        </p>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          style={{
            height: 40,
            padding: '0 16px',
            borderRadius: 10,
            border: 0,
            background: 'var(--violet-solid)',
            color: 'var(--on-violet)',
            font: `600 13px/1 ${FONT}`,
            cursor: 'pointer',
          }}
        >
          Open Today
        </button>
      </div>

      <div className="dc-mobile-screens-gallery" style={{ display: 'flex', gap: 26, flexWrap: 'wrap', paddingTop: 6 }}>
        <Phone title="Dashboard · mobile" heading="Today" active="home" cards={todayCards} />
        <Phone
          title="Orders · mobile"
          heading="Orders"
          active="orders"
          cards={orderCards}
          empty="No orders yet today."
        />
        <Phone
          title="Menu Control · mobile"
          heading="Menu"
          active="more"
          cards={menuCards}
          empty={
            settings.isLoading
              ? 'Loading menu…'
              : settings.error
                ? 'Settings offline — cannot load menu.'
                : 'No header nav links yet. Add them in Settings → Navigation.'
          }
        />
        <Phone
          title="Homepage sections · mobile"
          heading="Homepage"
          active="more"
          cards={homepageCards}
          empty={
            settings.isLoading
              ? 'Loading homepage…'
              : settings.error
                ? 'Settings offline — cannot load homepage sections.'
                : 'No homepage settings yet.'
          }
        />
      </div>
    </>
  )
}

function Phone({
  title,
  heading,
  active,
  cards,
  empty,
}: {
  title: string
  heading: string
  active: string
  cards: PhoneCard[]
  empty?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      <span
        style={{
          font: `600 11.5px/1 ${FONT}`,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}
      >
        {title}
      </span>
      <div
        style={{
          width: 376,
          maxWidth: '100%',
          height: 760,
          borderRadius: 36,
          border: '1px solid var(--line-2)',
          background: 'var(--surface)',
          padding: 9,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            flex: 1,
            borderRadius: 28,
            border: '1px solid var(--line)',
            background: 'var(--bg)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '11px 20px 7px',
              font: `600 11.5px/1 ${FONT}`,
              color: 'var(--ink-2)',
            }}
          >
            <span style={{ flex: 1 }}>9:41</span>
            <span style={{ display: 'flex', gap: 5, color: 'var(--ink-3)' }}>
              <DcIcon name="icon-signal" size={12} />
              <DcIcon name="icon-wifi" size={12} />
              <DcIcon name="icon-battery-full" size={12} />
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '8px 14px 10px',
              borderBottom: '1px solid var(--line)',
            }}
          >
            <span
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 30,
                height: 30,
                borderRadius: 9,
                background: 'var(--surface-2)',
                color: 'var(--ink-2)',
              }}
            >
              <DcIcon name="icon-menu" size={15} />
            </span>
            <span
              style={{
                flex: 1,
                font: `700 15px/1 ${FONT}`,
                letterSpacing: '-.02em',
                color: 'var(--ink)',
              }}
            >
              {heading}
            </span>
            <span
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 30,
                height: 30,
                borderRadius: 9,
                background: 'var(--surface-2)',
                color: 'var(--ink-2)',
              }}
            >
              <DcIcon name="icon-search" size={15} />
            </span>
          </div>

          <div
            style={{
              flex: 1,
              overflow: 'hidden',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {cards.length === 0 ? (
              <span
                style={{
                  padding: '30px 6px',
                  textAlign: 'center',
                  font: `400 12px/1.5 ${FONT}`,
                  color: 'var(--ink-3)',
                }}
              >
                {empty ?? 'Nothing here yet.'}
              </span>
            ) : (
              cards.map((c) => (
                <div
                  key={c.title}
                  style={{
                    padding: '12px 13px',
                    border: '1px solid var(--line)',
                    borderRadius: 11,
                    background: 'var(--surface)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                  }}
                >
                  <span
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      width: 32,
                      height: 32,
                      flex: 'none',
                      borderRadius: 9,
                      background: c.iconBg,
                      color: c.iconFg,
                    }}
                  >
                    <DcIcon name={c.icon} size={15} />
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        font: `600 13px/1.25 ${FONT}`,
                        color: 'var(--ink)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.title}
                    </span>
                    <span
                      style={{
                        font: `400 11.5px/1.3 ${FONT}`,
                        color: 'var(--ink-3)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.sub}
                    </span>
                  </span>
                  <span
                    style={{
                      font: `700 13px/1 ${MONO}`,
                      color: c.valueColor ?? 'var(--ink)',
                      flex: 'none',
                    }}
                  >
                    {c.value}
                  </span>
                </div>
              ))
            )}
          </div>

          <div
            style={{
              display: 'flex',
              padding: '8px 10px 16px',
              borderTop: '1px solid var(--line)',
              background: 'var(--surface)',
            }}
          >
            {TABS.map((t) => (
              <span
                key={t.id}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  color: t.id === active ? 'var(--violet)' : 'var(--ink-3)',
                }}
              >
                <DcIcon name={t.icon} size={17} />
                <span style={{ font: `600 9.5px/1 ${FONT}` }}>{t.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
