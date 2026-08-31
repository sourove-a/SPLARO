'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { dcPageStatus } from '@/components/dc/page-status'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcOrderDrawer } from '@/components/orders/DcOrderDrawer'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import { DcCard } from '@/components/dc/primitives/DcCard'
import { DcPager } from '@/components/dc/primitives/DcPager'
import { DcTable } from '@/components/dc/primitives/DcTable'
import type { DcBlock } from '@/components/dc/blocks/types'
import { FONT, MONO, formatTaka, statusToneStyle } from '@/components/dc/tokens'
import { downloadCsv } from '@/lib/admin/admin-actions'
import { isDevCourierConsignment, isLiveCourierConsignment } from '@/lib/admin/courier-save'
import { toastOk, toastFail } from '@/lib/admin/feedback'
import { DcModal } from '@/components/dc/DcModal'
import {
  useBulkUpdateOrderStatus,
  useOrders,
  useOrderStats,
  usePermission,
  usePurgeOrders,
} from '@/lib/api/hooks'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { useListQueryState } from '@/lib/hooks/use-list-query-state'
import { formatBdPhone } from '@/lib/format/bd-phone'
import { fetchOrders, type ApiOrder } from '@/lib/api/orders'

/** Fulfilment stages, in the order the floor works them. */
const STAGES = [
  'All',
  'Pending',
  'Confirmed',
  'Processing',
  'Packed',
  'Shipped',
  'Delivered',
  'Cancelled',
  'Returned',
] as const
type Stage = (typeof STAGES)[number]

/** Rows per request. The API refuses anything above 100. */
const PAGE_SIZE = 25
/** Export walks pages at the API's ceiling so a big export is few round trips. */
const EXPORT_PAGE_SIZE = 100

const SORTS = [
  ['newest', 'Newest first'],
  ['oldest', 'Oldest first'],
  ['total-desc', 'Highest value'],
  ['total-asc', 'Lowest value'],
] as const
type SortKey = (typeof SORTS)[number][0]

/** Stages an operator can move a selection to in one go. */
const BULK_STAGES = ['Confirmed', 'Processing', 'Packed', 'Shipped', 'Delivered'] as const

function stageFromUrl(raw: string | null): Stage | null {
  if (!raw) return null
  const hit = STAGES.find((s) => s.toUpperCase() === raw.toUpperCase())
  return hit ?? null
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function courierLabel(o: ApiOrder): { text: string; color: string } {
  const cid = o.courier?.consignmentId
  const track = o.courier?.trackingCode
  if (isLiveCourierConsignment(cid, track)) {
    return { text: o.courier?.provider ?? 'Booked', color: 'var(--ink-2)' }
  }
  if (isDevCourierConsignment(cid, track)) {
    return { text: 'Simulated', color: 'var(--warn)' }
  }
  if (o.status.toUpperCase() === 'PACKED') {
    return { text: 'Ready to book', color: 'var(--warn)' }
  }
  return { text: '—', color: 'var(--ink-3)' }
}

export function DcOrders() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="orders" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <Suspense fallback={<DcLoadingState blocks={[{ t: 'table', title: '', cols: [], rows: [] }]} />}>
        <DcOrdersBody />
      </Suspense>
    </DcScreenProvider>
  )
}

function DcOrdersBody() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [openOrder, setOpenOrder] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)

  const list = useListQueryState({ status: 'All', payment: 'All', sort: 'newest' })
  const stage = (stageFromUrl(list.filters.status) ?? 'All') as Stage
  const pay = list.filters.payment
  const sort = list.filters.sort as SortKey

  // A link into this screen (from the dashboard, a Telegram alert) may still
  // carry `?status=`; the hook seeds itself from the same params, so this only
  // has to cover a param that changes while the screen is already mounted.
  useEffect(() => {
    const linked = stageFromUrl(searchParams.get('status'))
    if (linked && linked !== stage) list.setFilter('status', linked)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  /*
   * Filtering, searching and paging all happen on the server now. They used to
   * run over `orders.data.orders`, which the API caps at 100 rows — so every
   * count on this screen described the first hundred orders while the header
   * beside them reported the true total.
   */
  const orders = useOrders({
    ...(stage !== 'All' ? { status: stage.toUpperCase() } : {}),
    ...(list.debouncedSearch.trim() ? { search: list.debouncedSearch.trim() } : {}),
    ...(pay !== 'All' ? { paymentMethod: pay } : {}),
    sort,
    page: list.page,
    limit: PAGE_SIZE,
  })
  const stats = useOrderStats(
    list.debouncedSearch.trim() ? { search: list.debouncedSearch.trim() } : {},
  )
  const { api } = useAdminConnection(25_000)
  const pageStatus = dcPageStatus([orders], api.pulse)
  const rows = useMemo(() => orders.data?.orders ?? [], [orders.data])
  const total = orders.data?.total ?? 0
  const bulkStatus = useBulkUpdateOrderStatus()
  const purge = usePurgeOrders()
  const canDeleteOrders = usePermission('orders', 'delete')
  const [confirmPurge, setConfirmPurge] = useState(false)
  const [purgeConfirmation, setPurgeConfirmation] = useState('')

  /** Store-wide tallies, keyed by the strip's own labels. */
  const stageCounts = useMemo(() => {
    const byStatus = stats.data?.byStatus ?? {}
    const counts: Record<string, number> = { All: stats.data?.total ?? 0 }
    for (const s of STAGES) {
      if (s === 'All') continue
      counts[s] = byStatus[s.toUpperCase()] ?? 0
    }
    return counts
  }, [stats.data])

  // Payment chips come from what the store actually takes. Derived from the
  // page in hand, so a method only used on older orders can be missing —
  // acceptable for a shortcut, and the value survives in the URL either way.
  const payMethods = useMemo(
    () => ['All', ...Array.from(new Set(rows.map((o) => o.paymentMethod).filter(Boolean)))],
    [rows],
  )

  // A selection is only meaningful for rows still on screen.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev
      const visible = new Set(rows.map((o) => o.id))
      const next = new Set([...prev].filter((id) => visible.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [rows])

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const runBulkStage = (target: string) => {
    const ids = [...selected]
    if (ids.length === 0) return
    bulkStatus.mutate(
      { orderIds: ids, status: target.toUpperCase() },
      {
        onSuccess: (res) => {
          setSelected(new Set())
          if (res.failed > 0) {
            toastFail(`${res.updated} moved to ${target}, ${res.failed} refused.`)
            return
          }
          toastOk(`${res.updated} order${res.updated === 1 ? '' : 's'} moved to ${target}.`)
        },
        onError: (err) =>
          toastFail(err instanceof Error ? err.message : 'Could not update those orders.'),
      },
    )
  }

  /**
   * How many of the selected rows the server will actually accept.
   *
   * Counted from the rows on screen, so a selection carried across pages can
   * undercount — the server is the authority either way and names every id it
   * refused. This is here to keep the operator from opening a confirmation for
   * a selection that has nothing to delete in it.
   */
  const purgeableSelected = useMemo(
    () => rows.filter((o) => selected.has(o.id) && o.status === 'CANCELLED').length,
    [rows, selected],
  )

  const runBulkPurge = () => {
    const ids = [...selected]
    if (ids.length === 0) return
    purge.mutate(ids, {
      onSuccess: (res) => {
        setConfirmPurge(false)
        setPurgeConfirmation('')
        setSelected(new Set())
        const gone = res.deleted.length
        if (gone > 0) {
          toastOk(`${gone} order${gone === 1 ? '' : 's'} deleted permanently.`)
        }
        // Every refusal carries its own reason, and "cancel it first" is the
        // one an operator will hit most — worth showing rather than a count.
        if (res.skipped.length > 0) {
          toastFail(
            gone > 0
              ? `${res.skipped.length} kept: ${res.skipped[0]?.reason ?? 'refused'}`
              : (res.skipped[0]?.reason ?? 'Nothing was deleted.'),
          )
        }
      },
      onError: (err) => {
        setConfirmPurge(false)
        toastFail(err instanceof Error ? err.message : 'Could not delete those orders.')
      },
    })
  }

  /**
   * Export every order matching the current filters, not the page on screen.
   *
   * Now that the list is paginated, exporting `rows` would silently hand over
   * 25 orders when the operator asked for the whole filtered set — so this
   * walks the pages and stops at the total the API reports.
   */
  const runExport = async () => {
    if (exporting) return
    if (total === 0) {
      toastFail('No orders match these filters.')
      return
    }
    setExporting(true)
    try {
      const query = {
        ...(stage !== 'All' ? { status: stage.toUpperCase() } : {}),
        ...(list.debouncedSearch.trim() ? { search: list.debouncedSearch.trim() } : {}),
        ...(pay !== 'All' ? { paymentMethod: pay } : {}),
        sort,
      }
      const collected: ApiOrder[] = []
      const lastPage = Math.ceil(total / EXPORT_PAGE_SIZE)
      for (let page = 1; page <= lastPage; page += 1) {
        const batch = await fetchOrders({ ...query, page, limit: EXPORT_PAGE_SIZE })
        collected.push(...batch.orders)
        if (batch.orders.length === 0) break
      }
      const date = new Date().toISOString().slice(0, 10)
      downloadCsv(`splaro-orders-${date}.csv`, [
        ['Order', 'Customer', 'Phone', 'Payment', 'Status', 'Total', 'Created'],
        ...collected.map((o) => [
          o.invoiceNumber,
          o.shippingName,
          o.shippingPhone,
          o.paymentMethod,
          o.status,
          String(o.total),
          o.createdAt,
        ]),
      ])
      toastOk(`Exported ${collected.length} order${collected.length === 1 ? '' : 's'}.`)
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not export these orders.')
    } finally {
      setExporting(false)
    }
  }

  const skeleton: DcBlock[] = [
    { t: 'seg', items: [] },
    { t: 'table', title: '', cols: [], rows: [] },
  ]

  return (
    <>
      <DcPageHead
        crumbGroup="Commerce"
        title="Orders"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={orders.isFetching ? 'syncing…' : `${orders.data?.total ?? 0} in total`}
        syncing={orders.isFetching}
        onSync={() => void orders.refetch()}
        actions={[
          {
            label: exporting ? 'Exporting…' : 'Export',
            icon: 'icon-download',
            onClick: () => void runExport(),
          },
          {
            label: 'New order',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: () => router.push('/dashboard/orders/new'),
          },
        ]}
      />

      {orders.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : orders.error ? (
        <DcErrorState
          error={`GET /admin/orders → ${orders.error instanceof Error ? orders.error.message : '500 Internal Server Error'}`}
          hint="The shell is fine — only the orders list failed to load."
          onRetry={() => {
            void orders.refetch()
          }}
        />
      ) : stats.data?.total === 0 && !list.isFiltered ? (
        // The store genuinely has no orders — distinct from a filter matching
        // none, which the table handles with a "clear filters" affordance.
        <DcEmptyState
          icon="icon-inbox"
          title="No orders yet"
          body="Orders land here the moment a customer checks out. Until then the packing queue stays empty."
          cta="Create an order"
          onCta={() => router.push('/dashboard/orders/new')}
        />
      ) : (
        <>
          <MobileOrdersList
            orders={rows}
            stage={stage}
            counts={stageCounts}
            query={list.search}
            onQuery={list.setSearch}
            onStage={(s) => list.setFilter('status', s)}
            onOpen={(id) => setOpenOrder(id)}
          />

          <div className="dc-desktop-route-panel">
          <StageStrip
            stage={stage}
            counts={stageCounts}
            loading={stats.isLoading}
            onSelect={(s) => list.setFilter('status', s)}
          />

          <DcCard clip>
            {selected.size > 0 ? (
              <div className="dc-bulkbar">
                <span className="dc-bulkbar__count">
                  {selected.size} order{selected.size === 1 ? '' : 's'} selected
                </span>
                {BULK_STAGES.map((target) => (
                  <button
                    key={target}
                    type="button"
                    className="dc-toolbar__tool"
                    disabled={bulkStatus.isPending}
                    onClick={() => runBulkStage(target)}
                  >
                    Move to {target}
                  </button>
                ))}
                {canDeleteOrders ? (
                  <button
                    type="button"
                    className="dc-toolbar__tool"
                    style={{ color: 'var(--bad)', borderColor: 'var(--bad-bd)' }}
                    disabled={purge.isPending || purgeableSelected === 0}
                    title={
                      purgeableSelected === 0
                        ? 'Only cancelled orders can be deleted permanently — cancel them first'
                        : `Permanently delete ${purgeableSelected} cancelled order${purgeableSelected === 1 ? '' : 's'}`
                    }
                    onClick={() => setConfirmPurge(true)}
                  >
                    Delete permanently
                  </button>
                ) : null}
                <button
                  type="button"
                  className="dc-toolbar__tool"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </button>
              </div>
            ) : (
              <div className="dc-card__head dc-toolbar">
                <label className="dc-toolbar__search">
                  <DcIcon name="icon-search" size={14} color="var(--ink-3)" />
                  <input
                    value={list.search}
                    onChange={(e) => list.setSearch(e.target.value)}
                    placeholder="Order ID, phone, name, or Product Code…"
                    aria-label="Search orders"
                  />
                </label>

                {payMethods.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={p === pay ? 'dc-toolbar__tool is-on' : 'dc-toolbar__tool'}
                    onClick={() => list.setFilter('payment', p)}
                  >
                    {p === 'All' ? 'All payments' : p}
                  </button>
                ))}

                <select
                  className="dc-toolbar__select"
                  aria-label="Sort orders"
                  value={sort}
                  onChange={(e) => list.setFilter('sort', e.target.value)}
                >
                  {SORTS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                {list.isFiltered ? (
                  <button type="button" className="dc-toolbar__tool" onClick={list.clear}>
                    Clear filters
                  </button>
                ) : null}
              </div>
            )}

            {rows.length === 0 ? (
              <div
                style={{
                  padding: '64px 20px',
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
                  <DcIcon name="icon-inbox" size={20} />
                </span>
                <span style={{ font: `600 14.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                  No orders match these filters
                </span>
                <span
                  style={{
                    font: `400 13px/1.5 ${FONT}`,
                    color: 'var(--ink-3)',
                    textAlign: 'center',
                    maxWidth: 320,
                  }}
                >
                  Try clearing the payment filter or searching a different order ID.
                </span>
                <button
                  type="button"
                  onClick={list.clear}
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
              <DcTable minWidth={940} sticky>
                <thead>
                  <tr>
                    <th className="is-check">
                      <input
                        type="checkbox"
                        className="dc-check"
                        aria-label="Select every order on this page"
                        checked={selected.size > 0 && selected.size === rows.length}
                        ref={(el) => {
                          // Partial selection reads as neither on nor off.
                          if (el) el.indeterminate = selected.size > 0 && selected.size < rows.length
                        }}
                        onChange={(e) =>
                          setSelected(e.target.checked ? new Set(rows.map((o) => o.id)) : new Set())
                        }
                      />
                    </th>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Courier</th>
                    <SortHeader
                      label="Total"
                      asc="total-asc"
                      desc="total-desc"
                      sort={sort}
                      onSort={(next) => list.setFilter('sort', next)}
                    />
                    <SortHeader
                      label="Placed"
                      asc="oldest"
                      desc="newest"
                      sort={sort}
                      onSort={(next) => list.setFilter('sort', next)}
                    />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => {
                    const tone = statusToneStyle(titleCase(o.status))
                    const courier = courierLabel(o)
                    return (
                      <tr
                        key={o.id}
                        onClick={() => setOpenOrder(o.id)}
                        className={selected.has(o.id) ? 'is-selected' : ''}
                        style={{ cursor: 'pointer' }}
                      >
                        <td
                          className="is-check"
                          onClick={(e) => {
                            // The row opens the drawer; ticking must not.
                            e.stopPropagation()
                          }}
                        >
                          <input
                            type="checkbox"
                            className="dc-check"
                            aria-label={`Select order ${o.invoiceNumber}`}
                            checked={selected.has(o.id)}
                            onChange={() => toggleRow(o.id)}
                          />
                        </td>
                        <td className="is-mono" style={{ fontWeight: 600 }}>
                          {o.invoiceNumber}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span>{o.shippingName}</span>
                            <span style={{ font: `400 11.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                              {formatBdPhone(o.shippingPhone)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '3px 8px',
                              borderRadius: 6,
                              font: `600 11px/1 ${FONT}`,
                              border: '1px solid var(--line)',
                              background: 'var(--surface-2)',
                              color: 'var(--ink-2)',
                            }}
                          >
                            {o.paymentMethod}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '3px 8px',
                              borderRadius: 6,
                              font: `600 11px/1 ${FONT}`,
                              border: `1px solid ${tone.bd}`,
                              background: tone.bg,
                              color: tone.fg,
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
                            {titleCase(o.status)}
                          </span>
                        </td>
                        <td style={{ color: courier.color }}>{courier.text}</td>
                        <td className="is-num" style={{ fontWeight: 600 }}>
                          {formatTaka(Number(o.total))}
                        </td>
                        <td
                          className="is-num"
                          style={{ fontWeight: 400, color: 'var(--ink-3)' }}
                          title={new Date(o.createdAt).toLocaleString('en-GB')}
                        >
                          {new Date(o.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </DcTable>
            )}

            <DcPager
              page={list.page}
              count={rows.length}
              total={total}
              limit={PAGE_SIZE}
              busy={orders.isFetching}
              onPage={list.setPage}
            />
          </DcCard>
          </div>
        </>
      )}
      <DcOrderDrawer orderId={openOrder} onClose={() => setOpenOrder(null)} />
      <DcModal
        open={confirmPurge}
        title={`Delete ${purgeableSelected} order${purgeableSelected === 1 ? '' : 's'} permanently?`}
        subtitle="This erases the orders and everything attached to them — items, payments, invoices and courier records. It cannot be undone. Anything in the selection that is not cancelled is left alone."
        confirmLabel="Delete permanently"
        danger
        busy={purge.isPending}
        busyLabel="Deleting…"
        onClose={() => {
          if (purge.isPending) return
          setConfirmPurge(false)
          setPurgeConfirmation('')
        }}
        onConfirm={() => {
          if (purgeConfirmation.trim().toUpperCase() !== 'DELETE') {
            toastFail('Type DELETE to confirm.')
            return
          }
          runBulkPurge()
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={{ font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>
            Type DELETE to confirm
          </span>
          <input
            value={purgeConfirmation}
            onChange={(event) => setPurgeConfirmation(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            style={{
              width: '100%',
              height: 38,
              padding: '0 11px',
              borderRadius: 9,
              border: '1px solid var(--bad-bd)',
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              outline: 'none',
              font: `600 13px/1 ${MONO}`,
            }}
          />
        </label>
      </DcModal>
    </>
  )
}

function MobileOrdersList({
  orders,
  stage,
  counts,
  query,
  onQuery,
  onStage,
  onOpen,
}: {
  orders: ApiOrder[]
  stage: Stage
  counts: Record<string, number>
  query: string
  onQuery: (q: string) => void
  onStage: (s: Stage) => void
  onOpen: (id: string) => void
}) {
  return (
    <div className="dc-mobile-route-panel" aria-label="Orders">
      <label className="dc-mobile-filter">
        <DcIcon name="icon-search" size={15} />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Order, phone, name, Product Code…"
          aria-label="Search orders"
        />
      </label>

      <div className="dc-mobile-chips" role="tablist" aria-label="Order stages">
        {STAGES.map((s) => {
          const on = s === stage
          const count = s === 'All' ? (counts.All ?? orders.length) : (counts[s] ?? 0)
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={on}
              className="dc-mobile-chip"
              data-on={on ? 'true' : 'false'}
              onClick={() => onStage(s)}
            >
              {s}
              <span className="dc-mobile-chip__n">{count}</span>
            </button>
          )
        })}
      </div>

      {orders.length === 0 ? (
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
          No orders match current filters.
        </div>
      ) : (
        <div className="dc-mobile-list">
          {orders.map((order) => {
            const status = titleCase(order.status)
            const tone = statusToneStyle(status)
            return (
              <button
                key={order.id}
                type="button"
                className="dc-mobile-list-card"
                onClick={() => onOpen(order.id)}
              >
                <span
                  className="dc-mobile-list-card__icon"
                  style={{ background: tone.bg, color: tone.fg }}
                >
                  <DcIcon name="icon-shopping-bag" size={15} />
                </span>
                <span className="dc-mobile-list-card__copy">
                  <span className="dc-mobile-list-card__title">
                    {order.invoiceNumber} · {order.shippingName}
                  </span>
                  <span className="dc-mobile-list-card__sub">
                    {status} · {order.paymentMethod} · {formatBdPhone(order.shippingPhone || '')}
                  </span>
                </span>
                <span className="dc-mobile-list-card__value">
                  {formatTaka(Number(order.total))}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * A sortable column header.
 *
 * Sorting runs on the server, so a click swaps the sort key rather than
 * reordering the page in hand — otherwise "highest value" would only mean
 * highest on this page.
 */
function SortHeader({
  label,
  asc,
  desc,
  sort,
  onSort,
}: {
  label: string
  asc: SortKey
  desc: SortKey
  sort: SortKey
  onSort: (next: SortKey) => void
}) {
  const state = sort === asc ? 'ascending' : sort === desc ? 'descending' : 'none'
  // `aria-sort` is a property of the column header, not of the control inside
  // it, so the cell carries the state and the button only carries the action.
  return (
    <th className="is-num" aria-sort={state} data-sort={state}>
      <button
        type="button"
        className="dc-sort"
        onClick={() => onSort(state === 'descending' ? asc : desc)}
      >
        {label}
        <DcIcon
          name={state === 'ascending' ? 'icon-arrow-up' : 'icon-arrow-down'}
          size={11}
          className="dc-sort__caret"
        />
      </button>
    </th>
  )
}

function StageStrip({
  stage,
  counts,
  loading,
  onSelect,
}: {
  stage: Stage
  counts: Record<string, number>
  loading?: boolean
  onSelect: (s: Stage) => void
}) {
  return (
    <div className="dc-card" style={{ display: 'flex', gap: 8, padding: 4, overflowX: 'auto' }}>
      {STAGES.map((s) => {
        const on = s === stage
        return (
          <button
            key={s}
            type="button"
            onClick={() => onSelect(s)}
            style={{
              flex: 1,
              minWidth: 104,
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              padding: '10px 12px',
              borderRadius: 9,
              cursor: 'pointer',
              textAlign: 'left',
              border: `1px solid ${on ? 'var(--violet-bd)' : 'transparent'}`,
              background: on ? 'var(--violet-soft)' : 'transparent',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 99,
                  background: on ? 'var(--violet)' : 'var(--ink-3)',
                }}
              />
              <span
                style={{
                  font: `600 10.5px/1 ${FONT}`,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                }}
              >
                {s}
              </span>
            </span>
            <span
              style={{
                font: `700 19px/1 ${FONT}`,
                letterSpacing: '-.02em',
                fontVariantNumeric: 'tabular-nums',
                color: on ? 'var(--violet)' : 'var(--ink)',
              }}
            >
              {loading ? '·' : (counts[s] ?? 0).toLocaleString()}
            </span>
          </button>
        )
      })}
    </div>
  )
}
