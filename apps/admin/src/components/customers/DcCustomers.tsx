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
import { verifyCustomerCreated } from '@/lib/admin/customer-mutation-verify'
import { bulkDeleteCustomers, bulkAddCustomerTags, createCustomer, mergeCustomers } from '@/lib/api/customers'
import { useCustomerPresence, useCustomers } from '@/lib/api/hooks'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { formatBdPhone, phoneMatches } from '@/lib/format/bd-phone'
import type { ApiCustomer } from '@/lib/api/customers'
import { customerPublicId } from '@/lib/format/customer-code'

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

/**
 * The shopper's own photo when they have one — Google sign-in supplies it, and
 * showing initials over the top of a real face made every row look the same.
 * `online` paints the presence dot; `null`-ish avatars fall back to initials.
 */
function CustomerAvatar({
  customer,
  online,
  size = 30,
  tone,
}: {
  customer: ApiCustomer
  online: boolean
  size?: number
  tone: { bg: string; bd: string; fg: string }
}) {
  const [broken, setBroken] = useState(false)
  const src = customer.avatar
  const dot = Math.max(8, Math.round(size * 0.32))

  return (
    <span style={{ position: 'relative', flex: 'none', width: size, height: size }}>
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: size,
          height: size,
          overflow: 'hidden',
          borderRadius: 99,
          border: `1px solid ${tone.bd}`,
          background: tone.bg,
          color: tone.fg,
          font: `700 ${Math.round(size * 0.37)}px/1 ${FONT}`,
        }}
      >
        {src && !broken ? (
          // Avatars are remote Google URLs. next/image would need every
          // provider host allow-listed in next.config and buys nothing at 30px.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            width={size}
            height={size}
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          initials(customer)
        )}
      </span>
      {online ? (
        <span
          title="On the site now"
          aria-label="Online now"
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: dot,
            height: dot,
            borderRadius: 99,
            background: 'var(--good, #16a34a)',
            // Rings against the row, not the avatar, so it reads at any tier colour.
            border: '2px solid var(--surface)',
          }}
        />
      ) : null}
    </span>
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
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [removeTargets, setRemoveTargets] = useState<ApiCustomer[] | null>(null)
  const [removeOrders, setRemoveOrders] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [hideStaff, setHideStaff] = useState(true)
  const [merging, setMerging] = useState(false)

  const customers = useCustomers({ limit: 200, staff: hideStaff ? 'hide' : 'include' })
  const presence = useCustomerPresence()
  const onlineIds = useMemo(
    () => new Set(presence.data?.online ?? []),
    [presence.data],
  )
  const onlineCount = useMemo(
    () => (customers.data?.customers ?? []).filter((c) => onlineIds.has(c.id)).length,
    [customers.data, onlineIds],
  )
  const staffHidden = customers.data?.staffHidden ?? 0
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
      return fullName(c).toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.customerCode?.toLowerCase().includes(q) ?? false)
    })
  }, [all, segment, query])

  const skeleton: DcBlock[] = [
    { t: 'kpis', items: [] },
    { t: 'table', title: '', cols: [], rows: [] },
  ]

  const selectedRows = useMemo(() => rows.filter((c) => selected.has(c.id)), [rows, selected])
  const allVisibleSelected = rows.length > 0 && selectedRows.length === rows.length

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllVisible = () => {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev)
        for (const c of rows) next.delete(c.id)
        return next
      }
      return new Set([...prev, ...rows.map((c) => c.id)])
    })
  }

  const openRemove = (targets: ApiCustomer[]) => {
    setRemoveOrders(false)
    setRemoveTargets(targets)
  }

  const runRemove = async () => {
    const targets = removeTargets
    if (!targets?.length) return
    setRemoving(true)
    try {
      const result = await bulkDeleteCustomers(
        targets.map((c) => c.id),
        { force: removeOrders },
      )
      if (result.deleted > 0) {
        const orders = result.ordersDeleted
          ? ` and ${result.ordersDeleted} order${result.ordersDeleted === 1 ? '' : 's'}`
          : ''
        toastOk(
          `Deleted ${result.deleted} customer${result.deleted === 1 ? '' : 's'}${orders}.`,
        )
      }
      if (result.skipped.length > 0) {
        // Named, not counted — the operator needs to know which record refused
        // and why before they decide to force it.
        const shown = result.skipped
          .slice(0, 3)
          .map((s) => `${s.name} (${s.reason})`)
          .join('; ')
        const more = result.skipped.length > 3 ? ` +${result.skipped.length - 3} more` : ''
        toastFail(`Kept ${result.skipped.length}: ${shown}${more}`)
      }
      setSelected((prev) => {
        const next = new Set(prev)
        for (const c of targets) next.delete(c.id)
        return next
      })
      setRemoveTargets(null)
      void customers.refetch()
    } catch (e) {
      toastFail(e instanceof Error ? e.message : 'Could not delete these customers.')
    } finally {
      setRemoving(false)
    }
  }

  const runMerge = async () => {
    if (selectedRows.length < 2) {
      toastFail('Select two or more profiles to merge.')
      return
    }
    const ranked = [...selectedRows].sort((a, b) => {
      const orders = (b.totalOrders ?? 0) - (a.totalOrders ?? 0)
      if (orders !== 0) return orders
      return String(a.customerCode ?? a.id).localeCompare(String(b.customerCode ?? b.id))
    })
    const keep = ranked[0]!
    const absorb = ranked.slice(1)
    setMerging(true)
    try {
      const result = await mergeCustomers(
        keep.id,
        absorb.map((c) => c.id),
      )
      if (!result.ok) {
        toastFail('Merge was not confirmed by the API.')
        return
      }
      toastOk(`Merged ${absorb.length + 1} profiles into ${customerPublicId(result.customer)}.`)
      setSelected(new Set([keep.id]))
      void customers.refetch()
    } catch (e) {
      toastFail(e instanceof Error ? e.message : 'Could not merge these customers.')
    } finally {
      setMerging(false)
    }
  }

  const runMarkStaff = async () => {
    if (selectedRows.length === 0) return
    try {
      const result = await bulkAddCustomerTags(
        selectedRows.map((c) => c.id),
        ['staff'],
      )
      if (!result.ok) {
        toastFail('Staff tag was not saved.')
        return
      }
      toastOk(`Marked ${result.updated} profile${result.updated === 1 ? '' : 's'} as staff.`)
      setSelected(new Set())
      void customers.refetch()
    } catch (e) {
      toastFail(e instanceof Error ? e.message : 'Could not tag staff accounts.')
    }
  }

  const removeOrderCount = (removeTargets ?? []).reduce((sum, c) => sum + (c.totalOrders ?? 0), 0)

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
          body="Guest checkout now creates a customer from the phone number. Staff test accounts stay hidden unless you show them."
          cta="Open Orders"
          onCta={() => router.push('/dashboard/orders')}
        />
      ) : (
        <>
          <MobileCustomersList
            customers={rows}
            segment={segment}
            counts={counts}
            query={query}
            onlineIds={onlineIds}
            onQuery={setQuery}
            onSegment={setSegment}
            onOpen={(id) => router.push(`/dashboard/customers/${encodeURIComponent(id)}`)}
          />

          <div className="dc-desktop-route-panel">
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
                  placeholder="Phone, name, or SPL-C code…"
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
              {selectedRows.length > 0 ? (
                <>
                  <span style={{ font: `600 12px/1 ${FONT}`, color: 'var(--ink-2)' }}>
                    {selectedRows.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="dc-hover-ink"
                    style={{
                      height: 30,
                      padding: '0 11px',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      background: 'var(--surface-2)',
                      color: 'var(--ink-2)',
                      cursor: 'pointer',
                      font: `600 12px/1 ${FONT}`,
                    }}
                  >
                    Clear
                  </button>
                  {selectedRows.length >= 2 ? (
                    <button
                      type="button"
                      disabled={merging}
                      onClick={() => void runMerge()}
                      className="dc-hover-ink"
                      style={{
                        height: 30,
                        padding: '0 11px',
                        borderRadius: 8,
                        border: '1px solid var(--line)',
                        background: 'var(--surface-2)',
                        color: 'var(--ink)',
                        cursor: merging ? 'wait' : 'pointer',
                        font: `600 12px/1 ${FONT}`,
                      }}
                    >
                      {merging ? 'Merging…' : `Merge ${selectedRows.length}`}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void runMarkStaff()}
                    className="dc-hover-ink"
                    style={{
                      height: 30,
                      padding: '0 11px',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      background: 'var(--surface-2)',
                      color: 'var(--ink-2)',
                      cursor: 'pointer',
                      font: `600 12px/1 ${FONT}`,
                    }}
                  >
                    Mark as staff
                  </button>
                  <button
                    type="button"
                    onClick={() => openRemove(selectedRows)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      height: 30,
                      padding: '0 11px',
                      borderRadius: 8,
                      border: '1px solid var(--bad-bd)',
                      background: 'var(--bad-soft)',
                      color: 'var(--bad)',
                      cursor: 'pointer',
                      font: `600 12px/1 ${FONT}`,
                    }}
                  >
                    <DcIcon name="icon-trash-2" size={13} />
                    <span>Delete selected</span>
                  </button>
                </>
              ) : null}
              <span style={{ font: `500 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                {rows.length} of {all.length}
              </span>
              {onlineCount > 0 ? (
                <span
                  title="Customers on the site right now"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    font: `600 12px/1 ${FONT}`,
                    color: 'var(--ink-2)',
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 99,
                      background: 'var(--good, #16a34a)',
                    }}
                  />
                  {onlineCount} online
                </span>
              ) : null}
              <button
                type="button"
                role="switch"
                aria-checked={hideStaff}
                aria-label="Hide staff test accounts"
                onClick={() => setHideStaff((v) => !v)}
                className="dc-hover-ink"
                style={{
                  height: 30,
                  padding: '0 11px',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: hideStaff ? 'var(--surface-2)' : 'var(--surface)',
                  color: 'var(--ink-2)',
                  cursor: 'pointer',
                  font: `600 12px/1 ${FONT}`,
                }}
              >
                {hideStaff
                  ? staffHidden > 0
                    ? `Staff hidden (${staffHidden})`
                    : 'Staff hidden'
                  : 'Showing staff'}
              </button>
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
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 36 }}>
                      <input
                        type="checkbox"
                        aria-label="Select all visible customers"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th style={th}>Customer</th>
                    <th style={th}>Tier</th>
                    <th style={{ ...th, textAlign: 'right' }}>Orders</th>
                    <th style={{ ...th, textAlign: 'right' }}>Spent</th>
                    <th style={{ ...th, textAlign: 'right' }}>COD risk</th>
                    <th style={th}>Segment</th>
                    <th style={{ ...th, textAlign: 'right' }}>Last order</th>
                    <th style={{ ...th, textAlign: 'right' }}>
                      <span className="sr-only">Actions</span>
                    </th>
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
                        onClick={() => router.push(`/dashboard/customers/${encodeURIComponent(customerPublicId(c))}`)}
                        className="dc-hover-surface"
                        style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
                      >
                        <td
                          style={{ padding: '10px 14px' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            aria-label={`Select ${fullName(c)}`}
                            checked={selected.has(c.id)}
                            onChange={() => toggleOne(c.id)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <CustomerAvatar
                              customer={c}
                              online={onlineIds.has(c.id)}
                              tone={tierTone}
                            />
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
                                {c.isStaff ? (
                                  <span
                                    style={{
                                      padding: '2px 6px',
                                      borderRadius: 5,
                                      font: `700 9.5px/1 ${FONT}`,
                                      letterSpacing: '.06em',
                                      border: '1px solid var(--line)',
                                      background: 'var(--surface-2)',
                                      color: 'var(--ink-3)',
                                    }}
                                  >
                                    STAFF
                                  </span>
                                ) : null}
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
                              {c.customerCode ? (
                                <span
                                  style={{ font: `500 11px/1 ${MONO}`, color: 'var(--violet)' }}
                                >
                                  {c.customerCode.toUpperCase()}
                                </span>
                              ) : null}
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
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <button
                            type="button"
                            title={`Delete ${fullName(c)}`}
                            aria-label={`Delete ${fullName(c)}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              openRemove([c])
                            }}
                            className="dc-hover-line"
                            style={{
                              display: 'grid',
                              placeItems: 'center',
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              border: '1px solid var(--line)',
                              background: 'var(--surface-2)',
                              color: 'var(--ink-3)',
                              cursor: 'pointer',
                            }}
                          >
                            <DcIcon name="icon-trash-2" size={13} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                </table>
              </div>
            )}
          </div>
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
                      const created = await createCustomer({
                        firstName: createFirst.trim(),
                        phone: createPhone.trim(),
                        ...(createLast.trim() ? { lastName: createLast.trim() } : {}),
                        ...(createEmail.trim() ? { email: createEmail.trim() } : {}),
                      })
                      if (
                        !(await verifyCustomerCreated(created, {
                          firstName: createFirst.trim(),
                          phone: createPhone.trim(),
                        }))
                      ) {
                        return
                      }
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

      {removeTargets?.length ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Delete customers"
          onClick={() => (removing ? undefined : setRemoveTargets(null))}
        >
          <div
            className="admin-modal w-full max-w-md"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal__header">
              <h2 className="text-base font-black" style={{ color: 'var(--ink)' }}>
                Delete {removeTargets.length === 1 ? fullName(removeTargets[0]!) : `${removeTargets.length} customers`}
              </h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--ink-3)' }}>
                Permanent. Removes the account, addresses, wishlist, reviews and loyalty history.
              </p>
            </div>
            <div className="admin-modal__body space-y-3">
              {removeTargets.length > 1 ? (
                <div
                  className="max-h-32 overflow-y-auto rounded-lg p-2 text-xs"
                  style={{ border: '1px solid var(--line)', background: 'var(--surface-2)' }}
                >
                  {removeTargets.map((c) => (
                    <div key={c.id} style={{ color: 'var(--ink-2)', padding: '2px 0' }}>
                      {fullName(c)} · {formatBdPhone(c.phone)} · {c.totalOrders} order
                      {c.totalOrders === 1 ? '' : 's'}
                    </div>
                  ))}
                </div>
              ) : null}

              <label
                className="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-xs"
                style={{
                  border: `1px solid ${removeOrders ? 'var(--bad-bd)' : 'var(--line)'}`,
                  background: removeOrders ? 'var(--bad-soft)' : 'var(--surface-2)',
                  color: 'var(--ink-2)',
                  lineHeight: 1.6,
                }}
              >
                <input
                  type="checkbox"
                  checked={removeOrders}
                  onChange={(e) => setRemoveOrders(e.target.checked)}
                  style={{ marginTop: 2, cursor: 'pointer' }}
                />
                <span>
                  <strong style={{ color: removeOrders ? 'var(--bad)' : 'var(--ink)' }}>
                    Also delete their orders
                  </strong>
                  <br />
                  Wipes {removeOrderCount} order{removeOrderCount === 1 ? '' : 's'} with their
                  invoices, payments and courier records, and returns the stock to inventory. Use
                  this for fake COD accounts. Leave it off and any customer holding orders is kept,
                  not deleted.
                </span>
              </label>
            </div>
            <div className="admin-modal__footer flex justify-end gap-2">
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                disabled={removing}
                onClick={() => setRemoveTargets(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn"
                disabled={removing}
                style={{
                  border: '1px solid var(--bad-bd)',
                  background: 'var(--bad-soft)',
                  color: 'var(--bad)',
                }}
                onClick={() => void runRemove()}
              >
                {removing ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function MobileCustomersList({
  customers,
  segment,
  counts,
  query,
  onlineIds,
  onQuery,
  onSegment,
  onOpen,
}: {
  customers: ApiCustomer[]
  segment: Segment
  counts: Record<string, number>
  query: string
  onlineIds: Set<string>
  onQuery: (q: string) => void
  onSegment: (s: Segment) => void
  onOpen: (id: string) => void
}) {
  return (
    <div className="dc-mobile-route-panel" aria-label="Customers">
      <label className="dc-mobile-filter">
        <DcIcon name="icon-search" size={15} />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Phone, name, SPL-C…"
          aria-label="Search customers"
        />
      </label>

      <div className="dc-mobile-chips" role="tablist" aria-label="Customer segments">
        {SEGMENTS.map((s) => {
          const on = s === segment
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={on}
              className="dc-mobile-chip"
              data-on={on ? 'true' : 'false'}
              onClick={() => onSegment(s)}
            >
              {s}
              <span className="dc-mobile-chip__n">{counts[s] ?? 0}</span>
            </button>
          )
        })}
      </div>

      {customers.length === 0 ? (
        <div
          style={{
            padding: '42px 18px',
            border: '1px solid var(--line)',
            borderRadius: 12,
            background: 'var(--surface)',
            color: 'var(--ink-3)',
            textAlign: 'center',
            font: `500 12.5px/1.5 ${FONT}`,
          }}
        >
          No customers match current filters.
        </div>
      ) : (
        <div className="dc-mobile-list">
          {customers.map((c) => {
            const seg = segmentOf(c)
            const tone = toneStyle(seg === 'At risk' || seg === 'Blocked' ? 'bad' : seg === 'VIP' ? 'info' : 'mute')
            return (
              <button
                key={c.id}
                type="button"
                className="dc-mobile-list-card"
                onClick={() => onOpen(customerPublicId(c))}
              >
                <CustomerAvatar customer={c} online={onlineIds.has(c.id)} size={34} tone={tone} />
                <span className="dc-mobile-list-card__copy">
                  <span className="dc-mobile-list-card__title">{fullName(c)}</span>
                  <span className="dc-mobile-list-card__sub">
                    {seg} · {formatBdPhone(c.phone || '')} · {c.totalOrders} orders
                  </span>
                </span>
                <span className="dc-mobile-list-card__value">
                  {formatTaka(Number(c.totalSpent || 0))}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
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
