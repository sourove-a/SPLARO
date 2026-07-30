'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { dcPageStatus } from '@/components/dc/page-status'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { FONT, MONO, formatTaka, toneStyle, type DcTone } from '@/components/dc/tokens'
import { downloadCsv } from '@/lib/admin/admin-actions'
import { toastOk, toastFail } from '@/lib/admin/feedback'
import { createCustomer } from '@/lib/api/customers'
import { useCustomers } from '@/lib/api/hooks'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { formatBdPhone, phoneMatches } from '@/lib/format/bd-phone'
import type { ApiCustomer } from '@/lib/api/customers'

const SEGMENTS = ['All', 'VIP', 'Repeat', 'New', 'At risk', 'Blocked'] as const
type Segment = (typeof SEGMENTS)[number]

/** Loyalty tier → chip tone. Violet stays reserved for nav and primary buttons. */
const TIER_TONE: Record<string, DcTone> = {
  DIAMOND: 'info',
  PLATINUM: 'info',
  GOLD: 'warn',
  SILVER: 'mute',
  BRONZE: 'mute',
}

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const th = {
  textAlign: 'left' as const,
  padding: '9px 14px',
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap' as const,
}

function fullName(c: ApiCustomer) {
  return `${c.firstName} ${c.lastName}`.trim() || 'Unnamed customer'
}

function initials(c: ApiCustomer) {
  return (
    `${c.firstName.charAt(0)}${c.lastName.charAt(0)}`.toUpperCase() ||
    fullName(c).charAt(0).toUpperCase()
  )
}

/** Segment is derived, not stored — same rule the design uses. */
function segmentOf(c: ApiCustomer): Exclude<Segment, 'All'> {
  if (c.isBlocked) return 'Blocked'
  if (c.codRiskScore >= 55) return 'At risk'
  if ((c.vipScore ?? 0) >= 80) return 'VIP'
  if (c.totalOrders >= 3) return 'Repeat'
  return 'New'
}

export function DcCustomers() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="customers" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcCustomersBody />
    </DcScreenProvider>
  )
}

function DcCustomersBody() {
  const router = useRouter()
  const [segment, setSegment] = useState<Segment>('All')
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createFirst, setCreateFirst] = useState('')
  const [createLast, setCreateLast] = useState('')
  const [createPhone, setCreatePhone] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [creating, setCreating] = useState(false)

  const customers = useCustomers({ limit: 200 })
  const { api } = useAdminConnection(25_000)
  const pageStatus = dcPageStatus([customers], api.pulse)
  const all = useMemo(() => customers.data?.customers ?? [], [customers.data])

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: all.length }
    for (const s of SEGMENTS) if (s !== 'All') c[s] = 0
    for (const cust of all) {
      const s = segmentOf(cust)
      c[s] = (c[s] ?? 0) + 1
    }
    return c
  }, [all])

  const lifetime = useMemo(
    () => all.reduce((sum, c) => sum + Number(c.totalSpent || 0), 0),
    [all],
  )
  const atRisk = counts['At risk'] ?? 0

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((c) => {
      if (segment !== 'All' && segmentOf(c) !== segment) return false
      if (!q) return true
      if (phoneMatches(c.phone, q)) return true
      return fullName(c).toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    })
  }, [all, segment, query])

  const skeleton: DcBlock[] = [
    { t: 'kpis', items: [] },
    { t: 'table', title: '', cols: [], rows: [] },
  ]

  return (
    <>
      <DcPageHead
        crumbGroup="Customers"
        title="Customers"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={customers.isFetching ? 'syncing…' : `${all.length} on file`}
        syncing={customers.isFetching}
        onSync={() => void customers.refetch()}
        actions={[
          {
            label: 'Export CSV',
            icon: 'icon-download',
            onClick: () => {
              if (rows.length === 0) {
                toastFail('No customers to export — load live data first.')
                return
              }
              const date = new Date().toISOString().slice(0, 10)
              downloadCsv(`splaro-customers-${date}.csv`, [
                ['Name', 'Phone', 'Tier', 'Orders', 'Lifetime', 'AOV', 'COD risk', 'Blocked', 'Id'],
                ...rows.map((c) => [
                  fullName(c),
                  c.phone,
                  c.loyaltyTier ?? '',
                  String(c.totalOrders ?? 0),
                  String(c.totalSpent ?? 0),
                  String(c.avgOrderValue ?? 0),
                  String(c.codRiskScore ?? 0),
                  c.isBlocked ? 'yes' : 'no',
                  c.id,
                ]),
              ])
              toastOk(`Exported ${rows.length} customer${rows.length === 1 ? '' : 's'}.`)
            },
          },
          {
            label: 'Add customer',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: () => setCreateOpen(true),
          },
        ]}
      />

      {customers.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : customers.error ? (
        <DcErrorState
          error={`GET /admin/customers → ${customers.error instanceof Error ? customers.error.message : '500 Internal Server Error'}`}
          hint="The shell is fine — only the customer list failed to load."
          onRetry={() => void customers.refetch()}
        />
      ) : all.length === 0 ? (
        <DcEmptyState
          icon="icon-users"
          title="No customers yet"
          body="A customer record is created on the first checkout. Nothing to segment until then."
          cta="Open Orders"
          onCta={() => router.push('/dashboard/orders')}
        />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(206px, 1fr))',
              gap: 12,
            }}
          >
            <Kpi label="Customers" value={String(all.length)} sub={`${counts['New'] ?? 0} new`} />
            <Kpi
              label="Repeat buyers"
              value={String(counts['Repeat'] ?? 0)}
              sub="3 or more orders"
            />
            <Kpi
              label="Lifetime value"
              value={formatTaka(lifetime)}
              sub="total spent, all time"
            />
            <Kpi
              label="At risk"
              value={String(atRisk)}
              sub="COD risk score 55+"
              color={atRisk > 0 ? 'var(--warn)' : 'var(--ink)'}
            />
          </div>

          <div style={{ ...card, overflow: 'auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 14px',
                borderBottom: '1px solid var(--line)',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 34,
                  padding: '0 11px',
                  borderRadius: 9,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  minWidth: 230,
                }}
              >
                <DcIcon name="icon-search" size={14} color="var(--ink-3)" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Phone, name or customer ID…"
                  aria-label="Search customers"
                  style={{
                    flex: 1,
                    border: 0,
                    background: 'transparent',
                    outline: 'none',
                    color: 'var(--ink)',
                    font: `400 13px/1 ${FONT}`,
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {SEGMENTS.map((s) => {
                  const on = s === segment
                  const t = toneStyle('vio')
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSegment(s)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        height: 30,
                        padding: '0 11px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        font: `600 12px/1 ${FONT}`,
                        border: `1px solid ${on ? t.bd : 'var(--line)'}`,
                        background: on ? t.bg : 'var(--surface-2)',
                        color: on ? t.fg : 'var(--ink-2)',
                      }}
                    >
                      <span>{s}</span>
                      <span style={{ font: `600 11px/1 ${MONO}`, opacity: 0.65 }}>
                        {counts[s] ?? 0}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div style={{ flex: 1 }} />
              <span style={{ font: `500 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                {rows.length} of {all.length}
              </span>
            </div>

            {rows.length === 0 ? (
              <div
                style={{
                  padding: '60px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-2)',
                    color: 'var(--ink-3)',
                  }}
                >
                  <DcIcon name="icon-user-x" size={20} />
                </span>
                <span style={{ font: `600 14.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                  No customers in this segment
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSegment('All')
                    setQuery('')
                  }}
                  style={{
                    height: 32,
                    padding: '0 14px',
                    borderRadius: 8,
                    border: '1px solid var(--line-2)',
                    background: 'var(--surface)',
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    font: `600 12.5px/1 ${FONT}`,
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Customer</th>
                    <th style={th}>Tier</th>
                    <th style={{ ...th, textAlign: 'right' }}>Orders</th>
                    <th style={{ ...th, textAlign: 'right' }}>Spent</th>
                    <th style={{ ...th, textAlign: 'right' }}>COD risk</th>
                    <th style={th}>Segment</th>
                    <th style={{ ...th, textAlign: 'right' }}>Last order</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const seg = segmentOf(c)
                    const segTone = toneStyle(
                      seg === 'Blocked' ? 'bad' : seg === 'At risk' ? 'warn' : seg === 'VIP' ? 'info' : 'mute',
                    )
                    const tierTone = toneStyle(TIER_TONE[c.loyaltyTier] ?? 'mute')
                    const riskColor =
                      c.codRiskScore >= 55
                        ? 'var(--bad)'
                        : c.codRiskScore >= 30
                          ? 'var(--warn)'
                          : 'var(--ink-2)'
                    return (
                      <tr
                        key={c.id}
                        onClick={() => router.push(`/dashboard/customers/${c.id}`)}
                        className="dc-hover-surface"
                        style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
                      >
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span
                              style={{
                                display: 'grid',
                                placeItems: 'center',
                                width: 30,
                                height: 30,
                                flex: 'none',
                                borderRadius: 99,
                                border: `1px solid ${tierTone.bd}`,
                                background: tierTone.bg,
                                color: tierTone.fg,
                                font: `700 11px/1 ${FONT}`,
                              }}
                            >
                              {initials(c)}
                            </span>
                            <span
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 3,
                                minWidth: 0,
                              }}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ font: `500 13px/1 ${FONT}`, color: 'var(--ink)' }}>
                                  {fullName(c)}
                                </span>
                                {c.isBlocked ? (
                                  <span
                                    style={{
                                      padding: '2px 6px',
                                      borderRadius: 5,
                                      font: `700 9.5px/1 ${FONT}`,
                                      letterSpacing: '.06em',
                                      border: '1px solid var(--bad-bd)',
                                      background: 'var(--bad-soft)',
                                      color: 'var(--bad)',
                                    }}
                                  >
                                    BLOCKED
                                  </span>
                                ) : null}
                              </span>
                              <span
                                style={{ font: `400 11.5px/1 ${MONO}`, color: 'var(--ink-3)' }}
                              >
                                {formatBdPhone(c.phone)}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '3px 8px',
                              borderRadius: 6,
                              font: `600 10.5px/1 ${FONT}`,
                              letterSpacing: '.05em',
                              border: `1px solid ${tierTone.bd}`,
                              background: tierTone.bg,
                              color: tierTone.fg,
                            }}
                          >
                            {c.loyaltyTier}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '10px 14px',
                            textAlign: 'right',
                            font: `600 13px/1 ${MONO}`,
                            color: 'var(--ink)',
                          }}
                        >
                          {c.totalOrders}
                        </td>
                        <td
                          style={{
                            padding: '10px 14px',
                            textAlign: 'right',
                            font: `600 13px/1 ${MONO}`,
                            color: 'var(--ink)',
                          }}
                        >
                          {formatTaka(Number(c.totalSpent || 0))}
                        </td>
                        <td
                          style={{
                            padding: '10px 14px',
                            textAlign: 'right',
                            font: `600 12.5px/1 ${MONO}`,
                            color: riskColor,
                          }}
                        >
                          {c.codRiskScore}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '3px 8px',
                              borderRadius: 6,
                              font: `600 11px/1 ${FONT}`,
                              border: `1px solid ${segTone.bd}`,
                              background: segTone.bg,
                              color: segTone.fg,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: 99,
                                background: 'currentColor',
                              }}
                            />
                            {seg}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '10px 14px',
                            textAlign: 'right',
                            font: `400 12px/1 ${FONT}`,
                            color: 'var(--ink-3)',
                          }}
                        >
                          {c.lastOrderDate
                            ? new Date(c.lastOrderDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                              })
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {createOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Add customer"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="admin-modal w-full max-w-md"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal__header">
              <h2 className="text-base font-black" style={{ color: 'var(--ink)' }}>
                Add customer
              </h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--ink-3)' }}>
                Creates a phone-only customer via POST /admin/customers
              </p>
            </div>
            <div className="admin-modal__body space-y-3">
              <input
                className="admin-input w-full"
                placeholder="First name"
                value={createFirst}
                onChange={(e) => setCreateFirst(e.target.value)}
              />
              <input
                className="admin-input w-full"
                placeholder="Last name (optional)"
                value={createLast}
                onChange={(e) => setCreateLast(e.target.value)}
              />
              <input
                className="admin-input w-full"
                placeholder="Phone 01XXXXXXXXX"
                value={createPhone}
                onChange={(e) => setCreatePhone(e.target.value)}
              />
              <input
                className="admin-input w-full"
                placeholder="Email (optional)"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
              />
            </div>
            <div className="admin-modal__footer flex justify-end gap-2">
              <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                disabled={creating}
                onClick={() => {
                  void (async () => {
                    if (!createFirst.trim() || !createPhone.trim()) {
                      toastFail('First name and phone are required.')
                      return
                    }
                    setCreating(true)
                    try {
                      await createCustomer({
                        firstName: createFirst.trim(),
                        phone: createPhone.trim(),
                        ...(createLast.trim() ? { lastName: createLast.trim() } : {}),
                        ...(createEmail.trim() ? { email: createEmail.trim() } : {}),
                      })
                      toastOk('Customer created.')
                      setCreateOpen(false)
                      setCreateFirst('')
                      setCreateLast('')
                      setCreatePhone('')
                      setCreateEmail('')
                      void customers.refetch()
                    } catch (e) {
                      toastFail(e instanceof Error ? e.message : 'Could not create customer.')
                    } finally {
                      setCreating(false)
                    }
                  })()
                }}
              >
                {creating ? 'Saving…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function Kpi({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub: string
  color?: string
}) {
  return (
    <div
      style={{ ...card, padding: '14px 15px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <span
        style={{
          font: `600 11px/1 ${FONT}`,
          letterSpacing: '.09em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}
      >
        {label}
      </span>
      <span
        style={{ font: `700 26px/1 ${FONT}`, letterSpacing: '-.025em', color: color ?? 'var(--ink)' }}
      >
        {value}
      </span>
      <span style={{ font: `400 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
    </div>
  )
}
