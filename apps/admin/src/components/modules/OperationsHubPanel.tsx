'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Package,
  PackageCheck,
  RefreshCw,
  Truck,
  Warehouse,
  WifiOff,
  Zap,
} from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { AdminNavLink } from '@/components/layout/AdminNavLink'
import { CourierBadge } from '@/components/ui/CourierBadge'
import { OperationsSubNav } from '@/components/operations/OperationsSubNav'
import { ShippingSection } from '@/components/settings/sections/ShippingSection'
import { EMPTY_SETTINGS } from '@/components/settings/SettingsShell'
import { ApiOfflineBanner, KpiGrid } from '@/components/modules/PlatformUi'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import {
  useAutomationRules,
  useBookCourier,
  useCourierShipments,
  useCourierStats,
  useOrders,
  useProcurementOverview,
  useProducts,
  useSettings,
  useUpdateSettings,
  useWmsOverview,
} from '@/lib/api/hooks'
import { useIntegrationsCatalog } from '@/lib/api/integration-hooks'
import { ApiError } from '@/lib/api/client'
import { toastApiSaved, toastFail, toastOk } from '@/lib/admin/feedback'
import { verifySettingsApplied } from '@/lib/admin/settings-save'
import type { AdminSettingsData } from '@/lib/api/settings'
import { formatRelativeTime } from '@/lib/api/orders'
import { productStock } from '@/lib/api/products'
import { formatBDT } from '@/lib/utils/currency'
import { cn } from '@/lib/utils/cn'

function statusFromQuery(isError: boolean, isLoading: boolean): 'ok' | 'warn' | 'down' | 'loading' {
  if (isLoading) return 'loading'
  if (isError) return 'down'
  return 'ok'
}

function OpsShell({
  moduleHref,
  title,
  subtitle,
  statusByHref,
  children,
}: {
  moduleHref: string
  title: string
  subtitle: string
  statusByHref?: Partial<Record<string, 'ok' | 'warn' | 'down' | 'loading'>>
  children: React.ReactNode
}) {
  return (
    <div className="space-y-5">
      <OperationsSubNav
        activeHref={moduleHref}
        {...(statusByHref ? { statusByHref } : {})}
      />
      <div className="ops-page-header">
        <div>
          <p className="ops-page-header__eyebrow">Operations</p>
          <h2 className="ops-page-header__title">{title}</h2>
          <p className="ops-page-header__sub">{subtitle}</p>
        </div>
        <AdminNavLink href="/dashboard/api-health" className="ops-page-header__health">
          API Health →
        </AdminNavLink>
      </div>
      {children}
    </div>
  )
}

function OperationsOverview({ moduleHref, statusByHref }: { moduleHref: string; statusByHref: Record<string, 'ok' | 'warn' | 'down' | 'loading'> }) {
  const settings = useSettings()
  const courierStats = useCourierStats()
  const wms = useWmsOverview()
  const procurement = useProcurementOverview()
  const rules = useAutomationRules()
  const integrations = useIntegrationsCatalog()
  const orders = useOrders({ limit: 30 })

  const pendingCourier = (orders.data?.orders ?? []).filter((o) =>
    ['CONFIRMED', 'PROCESSING', 'PENDING'].includes(o.status),
  ).length

  const steadfast = integrations.data?.integrations.find((i) => i.provider === 'steadfast')
  const inTransit =
    courierStats.data?.byStatus
      .filter((s) => ['BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(s.status))
      .reduce((n, s) => n + s._count, 0) ?? 0

  const cards = [
    {
      href: '/dashboard/shipping',
      label: 'Shipping',
      icon: Truck,
      stat: settings.data?.shipping.dhakaSameDay ? 'Dhaka on' : 'Dhaka off',
      meta: formatBDT(Number(settings.data?.shipping.dhakaDeliveryCharge ?? 0)) + ' · Dhaka',
      ok: !settings.isError,
    },
    {
      href: '/dashboard/courier-hub',
      label: 'Courier Hub',
      icon: PackageCheck,
      stat: `${pendingCourier} awaiting`,
      meta: `${inTransit} in transit · ${steadfast?.connected ? 'Steadfast live' : 'Steadfast not connected'}`,
      ok: !courierStats.isError && !orders.isError,
      warn: !steadfast?.connected,
    },
    {
      href: '/dashboard/automation-rules',
      label: 'Automation',
      icon: Zap,
      stat: `${rules.data?.filter((r) => r.isActive).length ?? 0} active`,
      meta: `${rules.data?.length ?? 0} rules total`,
      ok: !rules.isError,
    },
    {
      href: '/dashboard/warehouse',
      label: 'Warehouse',
      icon: Warehouse,
      stat: `${wms.data?.warehouses.length ?? 0} sites`,
      meta: `${wms.data?.stockSummary.available ?? 0} units available`,
      ok: !wms.isError,
    },
    {
      href: '/dashboard/supplier-management',
      label: 'Suppliers',
      icon: Building2,
      stat: `${procurement.data?.suppliers.length ?? 0} vendors`,
      meta: formatBDT(procurement.data?.suppliers.reduce((s, x) => s + Number(x.dueAmount), 0) ?? 0) + ' due',
      ok: !procurement.isError,
    },
  ]

  return (
    <OpsShell
      moduleHref={moduleHref}
      title="Operations Hub"
      subtitle="Shipping, courier, warehouse, suppliers — live from API."
      statusByHref={statusByHref}
    >
      <div className="ops-overview-grid">
        {cards.map(({ href, label, icon: Icon, stat, meta, ok, warn }) => (
          <AdminNavLink key={href} href={href} className="ops-overview-card">
            <div className="ops-overview-card__top">
              <div className="ops-overview-card__icon">
                <Icon className="h-4 w-4" />
              </div>
              {ok ? (
                warn ? (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
            </div>
            <p className="ops-overview-card__label">{label}</p>
            <p className="ops-overview-card__stat">{stat}</p>
            <p className="ops-overview-card__meta">{meta}</p>
            <span className="ops-overview-card__cta">
              Open <ArrowRight className="h-3 w-3" />
            </span>
          </AdminNavLink>
        ))}
      </div>
      {!steadfast?.connected ? (
        <div className="admin-health-banner admin-health-banner--warn">
          <p className="admin-health-banner__title">Courier API not connected</p>
          <p className="admin-health-banner__body">
            Add Steadfast keys in .env or connect via Integrations — bookings will fail until configured.
          </p>
          <AdminNavLink href="/dashboard/all-integrations" className="admin-btn admin-btn--gold mt-3 inline-flex px-4 py-2 text-xs">
            Open Integrations
          </AdminNavLink>
        </div>
      ) : null}
    </OpsShell>
  )
}

function ShippingView({
  moduleHref,
  statusByHref,
}: {
  moduleHref: string
  statusByHref: Record<string, 'ok' | 'warn' | 'down' | 'loading'>
}) {
  const { data, isLoading, isError, refetch } = useSettings()
  const updateSettings = useUpdateSettings()
  const [draft, setDraft] = useState<AdminSettingsData>(EMPTY_SETTINGS)

  useEffect(() => {
    if (data) setDraft({ ...EMPTY_SETTINGS, ...data })
  }, [data])

  const save = useCallback(
    (patch: Partial<AdminSettingsData>, label: string) => {
      updateSettings.mutate(patch, {
        onSuccess: (saved) => {
          const check = verifySettingsApplied(patch, saved)
          if (!check.ok) {
            toastFail(check.reason, 'shipping-save')
            return
          }
          toastApiSaved(label)
          setDraft({ ...EMPTY_SETTINGS, ...saved })
        },
        onError: (err) => {
          const msg = err instanceof ApiError ? err.message : 'Save failed'
          toastFail(msg, 'shipping-save')
        },
      })
    },
    [updateSettings],
  )

  if (isError) {
    return (
      <OpsShell moduleHref={moduleHref} title="Shipping" subtitle="Delivery zones and charges." statusByHref={statusByHref}>
        <ApiOfflineBanner />
      </OpsShell>
    )
  }

  if (isLoading) {
    return (
      <OpsShell moduleHref={moduleHref} title="Shipping" subtitle="Delivery zones and charges." statusByHref={statusByHref}>
        <p className="text-sm text-[var(--admin-text-muted)]">Loading shipping settings…</p>
      </OpsShell>
    )
  }

  return (
    <OpsShell
      moduleHref={moduleHref}
      title="Shipping"
      subtitle="Live storefront checkout rules — saves to API."
      statusByHref={statusByHref}
    >
      <KpiGrid
        items={[
          ['Dhaka', draft.shipping.dhakaSameDay ? 'Enabled' : 'Off', draft.shipping.dhakaSameDay ? 'success' : 'default'],
          ['Outside Dhaka', draft.shipping.outsideDhaka ? 'Enabled' : 'Off', draft.shipping.outsideDhaka ? 'success' : 'default'],
          ['Dhaka charge', formatBDT(Number(draft.shipping.dhakaDeliveryCharge ?? 0)), 'default'],
          ['Free from', draft.shipping.freeShippingMin ? formatBDT(Number(draft.shipping.freeShippingMin)) : 'Off', 'gold'],
        ]}
      />
      <ShippingSection
        draft={draft}
        setDraft={setDraft}
        save={save}
        saving={updateSettings.isPending}
        apiOnline
      />
      <AdminButton variant="ghost" onClick={() => void refetch()}>
        <RefreshCw className="h-4 w-4" />
        Reload from server
      </AdminButton>
    </OpsShell>
  )
}

function CourierHubView({
  moduleHref,
  statusByHref,
}: {
  moduleHref: string
  statusByHref: Record<string, 'ok' | 'warn' | 'down' | 'loading'>
}) {
  const { data: stats, isLoading: statsLoading, isError: statsError } = useCourierStats()
  const { data: shipments, isLoading: listLoading, isError: listError, refetch } = useCourierShipments({ limit: 25 })
  const { data: ordersData } = useOrders({ limit: 50 })
  const integrations = useIntegrationsCatalog()
  const bookCourier = useBookCourier()

  const steadfast = integrations.data?.integrations.find((i) => i.provider === 'steadfast')
  const pendingOrders = (ordersData?.orders ?? []).filter((o) =>
    ['CONFIRMED', 'PROCESSING', 'PENDING'].includes(o.status),
  )

  const byStatus = stats?.byStatus ?? []
  const inTransit = byStatus
    .filter((s) => ['BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(s.status))
    .reduce((n, s) => n + s._count, 0)
  const delivered = byStatus.find((s) => s.status === 'DELIVERED')?._count ?? 0
  const failed = byStatus.find((s) => s.status === 'FAILED')?._count ?? 0

  const handleBook = async (orderId: string) => {
    try {
      const res = await bookCourier.mutateAsync({ id: orderId })
      if (res.success) {
        toastOk(res.simulated ? 'Courier booked (dev stub)' : 'Courier booked', `book-${orderId}`)
        void refetch()
      } else {
        toastFail(res.error ?? 'Booking failed', `book-${orderId}`)
      }
    } catch (err) {
      toastFail(err instanceof ApiError ? err.message : 'Booking failed', `book-${orderId}`)
    }
  }

  if (statsError || listError) {
    return (
      <OpsShell moduleHref={moduleHref} title="Courier Hub" subtitle="Steadfast, Pathao & shipment tracking." statusByHref={statusByHref}>
        <ApiOfflineBanner />
      </OpsShell>
    )
  }

  return (
    <OpsShell
      moduleHref={moduleHref}
      title="Courier Hub"
      subtitle="Live shipments from /admin/courier — book from pending orders."
      statusByHref={statusByHref}
    >
      <div className="flex flex-wrap items-center gap-3">
        <CourierBadge provider="STEADFAST" variant="card" status={steadfast?.connected ? 'connected' : 'not connected'} />
        {steadfast && !steadfast.connected ? (
          <AdminNavLink href="/dashboard/all-integrations" className="text-xs font-black text-[var(--admin-accent)] underline">
            Connect Steadfast →
          </AdminNavLink>
        ) : null}
      </div>

      <KpiGrid
        items={[
          ['Awaiting booking', pendingOrders.length, 'warning'],
          ['In transit', statsLoading ? '…' : inTransit, 'default'],
          ['Delivered (30d)', statsLoading ? '…' : delivered, 'success'],
          ['Failed (30d)', statsLoading ? '…' : failed, failed > 0 ? 'warning' : 'default'],
        ]}
      />

      {pendingOrders.length > 0 ? (
        <section className="admin-module-table-wrap">
          <div className="admin-module-table-head">
            <Package className="h-4 w-4" />
            <p className="font-black text-[var(--admin-text-strong)]">Ready to book</p>
          </div>
          <table className="admin-module-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>City</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pendingOrders.slice(0, 8).map((o) => (
                <tr key={o.id}>
                  <td>
                    <AdminNavLink href={`/dashboard/orders/${o.id}`} className="font-black underline">
                      {o.invoiceNumber}
                    </AdminNavLink>
                  </td>
                  <td>{o.shippingName}</td>
                  <td>{o.shippingCity}</td>
                  <td>
                    <AdminButton
                      variant="gold"
                      className="!px-3 !py-1.5 !text-xs"
                      loading={bookCourier.isPending}
                      onClick={() => void handleBook(o.id)}
                    >
                      Book courier
                    </AdminButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="admin-module-table-wrap">
        <div className="admin-module-table-head">
          <Truck className="h-4 w-4" />
          <p className="font-black text-[var(--admin-text-strong)]">Shipments</p>
          <AdminButton variant="ghost" className="ml-auto !px-2 !py-1" onClick={() => void refetch()}>
            <RefreshCw className={cn('h-3.5 w-3.5', listLoading && 'animate-spin')} />
          </AdminButton>
        </div>
        {listLoading ? (
          <p className="px-4 py-6 text-sm text-[var(--admin-text-muted)]">Loading shipments…</p>
        ) : (shipments?.items.length ?? 0) === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--admin-text-muted)]">No courier shipments yet.</p>
        ) : (
          <table className="admin-module-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Tracking</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {shipments!.items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <AdminNavLink href={`/dashboard/orders/${s.orderId}`} className="font-black underline">
                      {s.order.invoiceNumber}
                    </AdminNavLink>
                  </td>
                  <td>
                    <CourierBadge provider={s.provider} />
                  </td>
                  <td>
                    <span className="admin-status admin-status--processing">{s.status}</span>
                  </td>
                  <td className="font-mono text-xs">{s.trackingCode ?? s.consignmentId ?? '—'}</td>
                  <td>{formatRelativeTime(s.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {(stats?.recentFailed.length ?? 0) > 0 ? (
        <div className="admin-health-banner admin-health-banner--danger">
          <p className="admin-health-banner__title">Recent failed bookings</p>
          <ul className="admin-health-banner__list">
            {stats!.recentFailed.map((f) => (
              <li key={f.id}>
                <strong>{f.order.invoiceNumber}</strong> — {f.failureReason ?? 'Unknown error'}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </OpsShell>
  )
}

function WarehouseView({
  moduleHref,
  statusByHref,
}: {
  moduleHref: string
  statusByHref: Record<string, 'ok' | 'warn' | 'down' | 'loading'>
}) {
  const wms = useWmsOverview()
  const products = useProducts({ limit: 50, status: 'published' })

  const catalogLow = useMemo(() => {
    const rows = (products.data?.products ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      stock: productStock(p),
    }))
    return rows.filter((r) => r.stock > 0 && r.stock <= 5)
  }, [products.data?.products])

  if (wms.isError) {
    return (
      <OpsShell moduleHref={moduleHref} title="Warehouse" subtitle="WMS stock and locations." statusByHref={statusByHref}>
        <ApiOfflineBanner message="WMS API offline — run pnpm dev:api" />
      </OpsShell>
    )
  }

  const warehouses = wms.data?.warehouses ?? []
  const summary = wms.data?.stockSummary

  return (
    <OpsShell
      moduleHref={moduleHref}
      title="Warehouse"
      subtitle="Multi-warehouse WMS + catalog stock alerts."
      statusByHref={statusByHref}
    >
      <KpiGrid
        items={[
          ['Warehouses', wms.isLoading ? '…' : warehouses.length, 'default'],
          ['Available units', wms.isLoading ? '…' : (summary?.available ?? 0), 'success'],
          ['Reserved', wms.isLoading ? '…' : (summary?.reserved ?? 0), 'default'],
          ['Low stock SKUs', catalogLow.length, catalogLow.length ? 'warning' : 'default'],
        ]}
      />

      <section className="admin-module-table-wrap">
        <div className="admin-module-table-head">
          <Warehouse className="h-4 w-4" />
          <p className="font-black text-[var(--admin-text-strong)]">Warehouse locations</p>
        </div>
        {wms.isLoading ? (
          <p className="px-4 py-6 text-sm text-[var(--admin-text-muted)]">Loading WMS…</p>
        ) : warehouses.length === 0 ? (
          <div className="ops-empty-state">
            <Warehouse className="h-8 w-8 text-[var(--admin-accent)]" />
            <p className="ops-empty-state__title">No warehouses configured</p>
            <p className="ops-empty-state__hint">Add locations in WMS module.</p>
            <AdminNavLink href="/dashboard/wms/warehouses" className="admin-btn admin-btn--gold px-4 py-2 text-xs font-black">
              Open WMS →
            </AdminNavLink>
          </div>
        ) : (
          <table className="admin-module-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>City</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w) => (
                <tr key={w.id}>
                  <td className="font-semibold">{w.name}</td>
                  <td>{w.code}</td>
                  <td>{w.city ?? '—'}</td>
                  <td>
                    <span className={cn('admin-status', w.isActive ? 'admin-status--delivered' : 'admin-status--draft')}>
                      {w.isActive ? 'active' : 'inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {catalogLow.length > 0 ? (
        <section className="admin-module-table-wrap">
          <div className="admin-module-table-head">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <p className="font-black text-[var(--admin-text-strong)]">Low stock (catalog)</p>
          </div>
          <table className="admin-module-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Units left</th>
              </tr>
            </thead>
            <tbody>
              {catalogLow.slice(0, 10).map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="font-black text-amber-600">{r.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <AdminNavLink href="/dashboard/wms/overview" className="admin-btn admin-btn--ghost px-4 py-2 text-xs">
          WMS Overview →
        </AdminNavLink>
        <AdminNavLink href="/dashboard/inventory" className="admin-btn admin-btn--ghost px-4 py-2 text-xs">
          Catalog inventory →
        </AdminNavLink>
      </div>
    </OpsShell>
  )
}

function SupplierManagementView({
  moduleHref,
  statusByHref,
}: {
  moduleHref: string
  statusByHref: Record<string, 'ok' | 'warn' | 'down' | 'loading'>
}) {
  const { data, isError, isLoading, refetch } = useProcurementOverview()
  const suppliers = data?.suppliers ?? []
  const orders = data?.orders ?? []
  const grns = data?.grns ?? []
  const openPos = orders.filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status)).length

  if (isError) {
    return (
      <OpsShell moduleHref={moduleHref} title="Supplier Management" subtitle="Vendors, POs, and GRNs." statusByHref={statusByHref}>
        <ApiOfflineBanner message="Procurement API offline." />
      </OpsShell>
    )
  }

  return (
    <OpsShell
      moduleHref={moduleHref}
      title="Supplier Management"
      subtitle="Live procurement data from commerce-os API."
      statusByHref={statusByHref}
    >
      <KpiGrid
        items={[
          ['Suppliers', isLoading ? '…' : suppliers.length, 'default'],
          ['Open POs', isLoading ? '…' : openPos, 'warning'],
          ['GRNs', isLoading ? '…' : grns.length, 'success'],
          ['Total due', isLoading ? '…' : formatBDT(suppliers.reduce((s, x) => s + Number(x.dueAmount), 0)), 'gold'],
        ]}
      />

      {isLoading ? (
        <p className="text-sm text-[var(--admin-text-muted)]">Loading suppliers…</p>
      ) : suppliers.length === 0 ? (
        <div className="ops-empty-state">
          <Building2 className="h-8 w-8 text-[var(--admin-accent)]" />
          <p className="ops-empty-state__title">No suppliers yet</p>
          <p className="ops-empty-state__hint">Create your first vendor in Procurement.</p>
          <AdminNavLink href="/dashboard/procurement/suppliers" className="admin-btn admin-btn--gold px-4 py-2 text-xs font-black">
            Add supplier →
          </AdminNavLink>
        </div>
      ) : (
        <section className="admin-module-table-wrap">
          <div className="admin-module-table-head">
            <Building2 className="h-4 w-4" />
            <p className="font-black text-[var(--admin-text-strong)]">Suppliers</p>
            <AdminButton variant="ghost" className="ml-auto !px-2 !py-1" onClick={() => void refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </AdminButton>
          </div>
          <table className="admin-module-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.slice(0, 20).map((s) => (
                <tr key={s.id}>
                  <td className="font-semibold">{s.name}</td>
                  <td className="text-xs">{s.phone ?? '—'}</td>
                  <td>{formatBDT(Number(s.dueAmount))}</td>
                  <td>
                    <span className={cn('admin-status', s.isActive ? 'admin-status--delivered' : 'admin-status--draft')}>
                      {s.isActive ? 'active' : 'inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {orders.length > 0 ? (
        <section className="admin-module-table-wrap">
          <div className="admin-module-table-head">
            <Package className="h-4 w-4" />
            <p className="font-black text-[var(--admin-text-strong)]">Recent purchase orders</p>
          </div>
          <table className="admin-module-table">
            <thead>
              <tr>
                <th>PO</th>
                <th>Supplier</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 8).map((o) => (
                <tr key={o.id}>
                  <td className="font-mono text-xs">{o.poNumber}</td>
                  <td>{o.supplier.name}</td>
                  <td>{formatBDT(Number(o.total))}</td>
                  <td>
                    <span className="admin-status admin-status--processing">{o.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <AdminNavLink href="/dashboard/procurement/purchase-orders" className="admin-btn admin-btn--ghost px-4 py-2 text-xs">
        Full procurement →
      </AdminNavLink>
    </OpsShell>
  )
}

export function OperationsHubPanel({ moduleHref }: ModuleContextProps) {
  const settings = useSettings()
  const courierStats = useCourierStats()
  const courierList = useCourierShipments({ limit: 1 })
  const wms = useWmsOverview()
  const procurement = useProcurementOverview()
  const rules = useAutomationRules()
  const integrations = useIntegrationsCatalog()

  const steadfast = integrations.data?.integrations.find((i) => i.provider === 'steadfast')

  const statusByHref: Record<string, 'ok' | 'warn' | 'down' | 'loading'> = {
    '/dashboard/operations': 'ok',
    '/dashboard/shipping': statusFromQuery(settings.isError, settings.isLoading),
    '/dashboard/courier-hub':
      courierStats.isError || courierList.isError
        ? 'down'
        : steadfast && !steadfast.connected
          ? 'warn'
          : statusFromQuery(false, courierStats.isLoading),
    '/dashboard/automation-rules': statusFromQuery(rules.isError, rules.isLoading),
    '/dashboard/warehouse': statusFromQuery(wms.isError, wms.isLoading),
    '/dashboard/supplier-management': statusFromQuery(procurement.isError, procurement.isLoading),
  }

  if (moduleHref === '/dashboard/operations') {
    return <OperationsOverview moduleHref={moduleHref} statusByHref={statusByHref} />
  }
  if (moduleHref === '/dashboard/shipping') {
    return <ShippingView moduleHref={moduleHref} statusByHref={statusByHref} />
  }
  if (moduleHref === '/dashboard/courier-hub') {
    return <CourierHubView moduleHref={moduleHref} statusByHref={statusByHref} />
  }
  if (moduleHref === '/dashboard/warehouse') {
    return <WarehouseView moduleHref={moduleHref} statusByHref={statusByHref} />
  }
  if (moduleHref === '/dashboard/supplier-management') {
    return <SupplierManagementView moduleHref={moduleHref} statusByHref={statusByHref} />
  }

  return (
    <OpsShell moduleHref="/dashboard/operations" title="Operations" subtitle="Select a module from the tabs above." statusByHref={statusByHref}>
      <AdminNavLink href="/dashboard/operations" className="admin-btn admin-btn--gold px-4 py-2 text-xs">
        Open Operations Hub
      </AdminNavLink>
    </OpsShell>
  )
}
