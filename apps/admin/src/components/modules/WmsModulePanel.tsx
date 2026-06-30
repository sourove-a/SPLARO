'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { ArrowLeftRight, Building2, MapPin, Plus, RefreshCw, Download, Search, Truck, Warehouse } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { renderModuleSubPanel } from '@/components/modules/renderModuleSubPanel'
import { useWmsOverview } from '@/lib/api/hooks'
import type { WmsWarehouse } from '@/lib/api/commerce-os'
import { formatRelativeTime } from '@/lib/api/orders'

// ─── Design tokens ─────────────────────────────────────────────────────────────
const GOLD = '#5E7CFF'
const GOLD_LIGHT = 'rgba(200,169,126,0.10)'
const GOLD_BORDER = 'rgba(200,169,126,0.32)'


const TH: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }
const TD: React.CSSProperties = { padding: '11px 16px', fontSize: 13, color: 'var(--admin-text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.4)' }

// ─── Shared components ─────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { bg: string; text: string; border: string }> = {
  active:     { bg: 'rgba(22,163,74,0.10)',  text: '#15803D', border: 'rgba(22,163,74,0.30)' },
  inactive:   { bg: 'rgba(156,163,175,0.10)', text: '#4B5563', border: 'rgba(156,163,175,0.30)' },
  draft:      { bg: 'rgba(245,158,11,0.10)', text: '#B45309', border: 'rgba(245,158,11,0.30)' },
  success:    { bg: 'rgba(22,163,74,0.10)',  text: '#15803D', border: 'rgba(22,163,74,0.30)' },
  processing: { bg: 'rgba(59,130,246,0.10)', text: '#1D4ED8', border: 'rgba(59,130,246,0.30)' },
  pending:    { bg: 'rgba(245,158,11,0.10)', text: '#B45309', border: 'rgba(245,158,11,0.30)' },
}

function StatusPill({ value }: { value: string }) {
  const key = value.toLowerCase().replace(/[\s_]/g, ' ').trim()
  const fallback = { bg: 'rgba(156,163,175,0.10)', text: '#4B5563', border: 'rgba(156,163,175,0.30)' }
  const s = STATUS_MAP[key] ?? fallback
  return (
    <span style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text, borderRadius: 8, padding: '2px 10px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>
      {value}
    </span>
  )
}

function KpiCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  const accentColor = accent === 'gold' ? GOLD : accent === 'success' ? '#16A34A' : accent === 'warning' ? '#D97706' : '#6366F1'
  const accentBg = accent === 'gold' ? GOLD_LIGHT : accent === 'success' ? 'rgba(22,163,74,0.08)' : accent === 'warning' ? 'rgba(217,119,6,0.08)' : 'rgba(99,102,241,0.08)'
  return (
    <div className="settings-card admin-panel-glass-subtle" style={{ padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)` }} />
      <div style={{ width: 28, height: 28, borderRadius: 8, background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor }} />
      </div>
      <p style={{ fontSize: 20, fontWeight: 900, color: 'var(--admin-text-primary)', lineHeight: 1, margin: 0 }}>{value}</p>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4, marginBottom: 0 }}>{label}</p>
    </div>
  )
}

function PanelHeader({ icon: Icon, title, kpis }: { icon: React.ElementType; title: string; kpis: [string, string | number, string?][] }) {
  return (
    <div className="settings-card admin-panel-glass" style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 18, height: 18, color: GOLD }} strokeWidth={2} />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--admin-text-primary)', margin: 0 }}>{title}</h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpis.length}, 1fr)`, gap: 10 }}>
        {kpis.map(([label, value, accent]) => (
          <KpiCard key={label} label={label} value={value} {...(accent !== undefined ? { accent } : {})} />
        ))}
      </div>
    </div>
  )
}

function Toolbar({ query, onQuery, placeholder, createLabel, onCreate, onRefresh, onExport, extra }: {
  query: string; onQuery: (v: string) => void; placeholder?: string
  createLabel?: string; onCreate?: () => void
  onRefresh?: () => void; onExport?: () => void
  extra?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        {placeholder !== '' && (
          <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 380 }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--admin-text-muted)', pointerEvents: 'none' }} />
            <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder ?? 'Search…'} className="admin-catalog-input" style={{ width: '100%', paddingLeft: 36, outline: 'none' }} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          {onCreate && (
            <button type="button" onClick={onCreate} style={{ background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, color: '#8B6914', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus style={{ width: 13, height: 13 }} />{createLabel}
            </button>
          )}
          {onRefresh && (
            <button type="button" onClick={onRefresh} className="admin-catalog-action" style={{ padding: '8px 12px', cursor: 'pointer'  }}>
              <RefreshCw style={{ width: 12, height: 12 }} />
            </button>
          )}
          {onExport && (
            <button type="button" onClick={onExport} className="admin-catalog-action" style={{ padding: '8px 12px', cursor: 'pointer'  }}>
              <Download style={{ width: 12, height: 12 }} />
            </button>
          )}
        </div>
        {extra}
      </div>
    </div>
  )
}

function GlassTable({ title, footer, icon: Icon, children }: { title: string; footer?: string; icon?: React.ElementType; children: React.ReactNode }) {
  const I = Icon ?? Warehouse
  return (
    <div className="settings-card admin-panel-glass" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <I style={{ width: 13, height: 13, color: GOLD }} />
        </div>
        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--admin-text-primary)', margin: 0 }}>{title}</p>
      </div>
      <div style={{ overflowX: 'auto' }}>{children}</div>
      {footer && <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, color: 'var(--admin-text-muted)' }}>{footer}</div>}
    </div>
  )
}

function ErrorBanner({ msg }: { msg: string }) {
  return <div className="settings-card admin-panel-glass-subtle" style={{ padding: '12px 16px', borderLeft: '3px solid #EF4444', color: '#B91C1C', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{msg}</div>
}

// ─── WMS helpers ───────────────────────────────────────────────────────────────
function warehouseSkus(wh: WmsWarehouse) {
  let bins = 0, units = 0
  for (const zone of wh.zones ?? [])
    for (const rack of zone.racks ?? [])
      for (const bin of rack.bins ?? []) { bins++; units += bin.availableQty + bin.reservedQty }
  return { bins, units }
}

function warehouseCapacity(wh: WmsWarehouse) {
  const { bins, units } = warehouseSkus(wh)
  if (bins === 0) return '—'
  return `${Math.min(99, Math.round((units / Math.max(bins * 50, 1)) * 100))}%`
}

function useWmsData() {
  const { data, isLoading, isError, refetch } = useWmsOverview()
  const warehouses = data?.warehouses ?? []
  const movements = data?.movements ?? []
  const transfers = data?.transfers ?? []
  const stock = data?.stockSummary ?? { available: 0, reserved: 0, damaged: 0 }
  const productStock = data?.productStock
  const totalUnits = stock.available + stock.reserved || productStock?.units || 0
  const totalSkus = productStock?.skus ?? warehouses.reduce((s, w) => s + warehouseSkus(w).bins, 0)
  return { warehouses, movements, transfers, stock, productStock, totalUnits, totalSkus, isLoading, isError, refetch }
}

// ─── Panels ────────────────────────────────────────────────────────────────────
function WmsOverviewPanel() {
  const { warehouses, transfers, totalUnits, totalSkus, isLoading, isError, refetch } = useWmsData()
  if (isError) return <ErrorBanner msg="WMS API offline — start pnpm dev:api on port 4000." />

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <PanelHeader icon={Warehouse} title="WMS Overview" kpis={[
        ['Warehouses', isLoading ? '…' : warehouses.length],
        ['SKUs tracked', isLoading ? '…' : totalSkus, 'success'],
        ['Available units', isLoading ? '…' : totalUnits, 'gold'],
        ['In transit', isLoading ? '…' : transfers.filter((t) => t.status === 'IN_TRANSIT' || t.status === 'PENDING').length, 'warning'],
      ]} />
      <Toolbar query="" onQuery={() => {}} placeholder="" createLabel="Stock adjustment" onCreate={() => toast('Record adjustments from Catalog → Inventory.', { icon: '📦' })} onRefresh={() => void refetch()} onExport={() => toast.error('This action is not available yet — feature pending.')} />
      <GlassTable icon={Warehouse} title="Warehouse summary" footer="Live data from commerce-os WMS API">
        {isLoading ? (
          <p style={{ padding: '20px', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>Loading warehouses…</p>
        ) : warehouses.length === 0 ? (
          <p style={{ padding: '20px', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>No warehouses yet. Run <code style={{ background: 'rgba(0,0,0,0.06)', borderRadius: 4, padding: '1px 5px' }}>pnpm db:seed</code> to create Dhaka Main.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Warehouse', 'Location', 'Staff', 'Bins', 'Capacity', 'Status', ''].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {warehouses.map((w) => {
                const { bins } = warehouseSkus(w)
                const capacity = warehouseCapacity(w)
                const capNum = capacity !== '—' ? parseInt(capacity) : 0
                return (
                  <tr key={w.id}>
                    <td style={{ ...TD, fontWeight: 700, color: 'var(--admin-text-primary)' }}>{w.name}</td>
                    <td style={TD}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                        <MapPin style={{ width: 12, height: 12 }} />
                        {w.city ?? w.address ?? '—'}
                      </span>
                    </td>
                    <td style={TD}>{w.staff?.length ?? 0}</td>
                    <td style={{ ...TD, fontWeight: 800 }}>{bins}</td>
                    <td style={{ ...TD, fontWeight: 800, color: capNum > 75 ? '#D97706' : 'var(--admin-text-primary)' }}>{capacity}</td>
                    <td style={TD}><StatusPill value={w.isActive ? 'active' : 'inactive'} /></td>
                    <td style={TD}><RowActionsMenu recordName={w.name} moduleHref="/dashboard/wms/warehouses" recordId={w.id} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </GlassTable>
    </div>
  )
}

function WarehousesPanel() {
  const [query, setQuery] = useState('')
  const { warehouses, isLoading, isError, refetch } = useWmsData()
  const filtered = useMemo(() => { const q = query.toLowerCase(); return warehouses.filter((w) => !q || w.name.toLowerCase().includes(q) || w.code.toLowerCase().includes(q) || (w.city ?? '').toLowerCase().includes(q)) }, [query, warehouses])

  if (isError) return <ErrorBanner msg="WMS API offline — start pnpm dev:api." />

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <PanelHeader icon={Building2} title="Warehouses" kpis={[
        ['Locations', isLoading ? '…' : warehouses.length],
        ['Total staff', warehouses.reduce((s, w) => s + (w.staff?.length ?? 0), 0), 'success'],
        ['Zones', warehouses.reduce((s, w) => s + (w.zones?.length ?? 0), 0), 'gold'],
        ['Bins', warehouses.reduce((s, w) => s + warehouseSkus(w).bins, 0)],
      ]} />
      <Toolbar query={query} onQuery={setQuery} placeholder="Search warehouse…" createLabel="Add warehouse" onCreate={() => toast('Warehouse creation UI coming soon.', { icon: '🏭' })} onRefresh={() => void refetch()} onExport={() => toast.error('This action is not available yet — feature pending.')} />
      <GlassTable icon={Building2} title={`Warehouses · ${filtered.length}`} footer="Zones · Racks · Bins from database">
        {filtered.length === 0 ? (
          <p style={{ padding: '20px', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>No warehouses match your search.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Code', 'Name', 'City', 'Staff', 'Bins', 'Capacity', 'Status', ''].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((w) => {
                const capacity = warehouseCapacity(w)
                const capNum = capacity !== '—' ? parseInt(capacity) : 0
                return (
                  <tr key={w.id}>
                    <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12, fontWeight: 800, color: GOLD }}>{w.code}</td>
                    <td style={{ ...TD, fontWeight: 700, color: 'var(--admin-text-primary)' }}>{w.name}</td>
                    <td style={{ ...TD, fontSize: 12 }}>{w.city ?? '—'}</td>
                    <td style={TD}>{w.staff?.length ?? 0}</td>
                    <td style={TD}>{warehouseSkus(w).bins}</td>
                    <td style={{ ...TD, fontWeight: 800, color: capNum > 75 ? '#D97706' : 'var(--admin-text-primary)' }}>{capacity}</td>
                    <td style={TD}><StatusPill value={w.isActive ? 'active' : 'inactive'} /></td>
                    <td style={TD}><RowActionsMenu recordName={w.name} moduleHref="/dashboard/wms/warehouses" recordId={w.id} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </GlassTable>
    </div>
  )
}

function StockMovementsPanel() {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const { movements, isLoading, isError, refetch } = useWmsData()

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return movements.filter((m) => {
      const matchQ = !q || (m.sku ?? '').toLowerCase().includes(q) || (m.note ?? '').toLowerCase().includes(q)
      const reason = m.reason.toLowerCase()
      const matchT = typeFilter === 'all' || (typeFilter === 'inbound' && m.delta > 0) || (typeFilter === 'outbound' && m.delta < 0) || reason.includes(typeFilter)
      return matchQ && matchT
    })
  }, [query, typeFilter, movements])

  if (isError) return <ErrorBanner msg="WMS movements API offline." />

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <PanelHeader icon={ArrowLeftRight} title="Stock Movements" kpis={[
        ['Movements', isLoading ? '…' : movements.length],
        ['Inbound', movements.filter((m) => m.delta > 0).length, 'success'],
        ['Outbound', movements.filter((m) => m.delta < 0).length, 'gold'],
        ['Net delta', movements.reduce((s, m) => s + m.delta, 0), 'warning'],
      ]} />
      <Toolbar
        query={query} onQuery={setQuery} placeholder="Search SKU or note…"
        createLabel="Record movement" onCreate={() => toast('Movement logging UI coming soon.', { icon: '📝' })}
        onRefresh={() => void refetch()} onExport={() => toast.error('This action is not available yet — feature pending.')}
        extra={
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(['all', 'inbound', 'outbound', 'adjustment', 'transfer'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTypeFilter(t)} style={{
                background: typeFilter === t ? GOLD_LIGHT : 'rgba(255,255,255,0.7)',
                border: `1px solid ${typeFilter === t ? GOLD_BORDER : 'rgba(255,255,255,0.8)'}`,
                color: typeFilter === t ? '#8B6914' : 'var(--admin-text-secondary)',
                borderRadius: 9, padding: '5px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s', textTransform: 'capitalize',
              }}>
                {t === 'all' ? 'All types' : t}
              </button>
            ))}
          </div>
        }
      />
      <GlassTable icon={ArrowLeftRight} title={`Stock movements · ${filtered.length}`} footer="Audit trail from stock_movement_log">
        {filtered.length === 0 ? (
          <p style={{ padding: '20px', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>{movements.length === 0 ? 'No stock movements logged yet.' : 'No movements match filters.'}</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['ID', 'Reason', 'SKU', 'Delta', 'Before → After', 'Note', 'Time'].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id}>
                  <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12, color: 'var(--admin-text-muted)' }}>{m.id.slice(0, 8)}</td>
                  <td style={{ ...TD, fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>{m.reason.replace(/_/g, ' ').toLowerCase()}</td>
                  <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12 }}>{m.sku ?? '—'}</td>
                  <td style={{ ...TD, fontWeight: 900, color: m.delta > 0 ? '#15803D' : '#B91C1C' }}>{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
                  <td style={{ ...TD, fontSize: 12, color: 'var(--admin-text-muted)' }}>{m.quantityBefore} → {m.quantityAfter}</td>
                  <td style={{ ...TD, fontSize: 12 }}>{m.note ?? '—'}</td>
                  <td style={{ ...TD, fontSize: 12, color: 'var(--admin-text-muted)' }}>{formatRelativeTime(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassTable>
    </div>
  )
}

function StockTransfersPanel() {
  const [query, setQuery] = useState('')
  const { transfers, isLoading, isError, refetch } = useWmsData()
  const filtered = useMemo(() => { const q = query.toLowerCase(); return transfers.filter((t) => !q || t.fromWarehouse.name.toLowerCase().includes(q) || t.toWarehouse.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)) }, [query, transfers])

  if (isError) return <ErrorBanner msg="WMS transfers API offline." />

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <PanelHeader icon={Truck} title="Stock Transfers" kpis={[
        ['Transfers', isLoading ? '…' : transfers.length],
        ['In transit', transfers.filter((t) => t.status === 'IN_TRANSIT').length, 'warning'],
        ['Completed', transfers.filter((t) => t.status === 'COMPLETED' || t.status === 'DELIVERED').length, 'success'],
        ['Items', transfers.reduce((s, t) => s + (t.items?.length ?? 0), 0), 'gold'],
      ]} />
      <Toolbar query={query} onQuery={setQuery} placeholder="Search warehouse or transfer ID…" createLabel="New transfer" onCreate={() => toast('Transfer wizard coming soon.', { icon: '🚚' })} onRefresh={() => void refetch()} onExport={() => toast.error('This action is not available yet — feature pending.')} />
      <GlassTable icon={Truck} title={`Stock transfers · ${filtered.length}`} footer="Inter-warehouse transfers from database">
        {filtered.length === 0 ? (
          <p style={{ padding: '20px', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>No stock transfers yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Transfer', 'From', 'To', 'Items', 'Created', 'Status', ''].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12, fontWeight: 800, color: GOLD }}>{t.id.slice(0, 8)}</td>
                  <td style={{ ...TD, fontSize: 12 }}>{t.fromWarehouse.name}</td>
                  <td style={{ ...TD, fontSize: 12 }}>{t.toWarehouse.name}</td>
                  <td style={{ ...TD, fontWeight: 800 }}>{t.items?.length ?? 0}</td>
                  <td style={{ ...TD, fontSize: 12, color: 'var(--admin-text-muted)' }}>{formatRelativeTime(t.createdAt)}</td>
                  <td style={TD}><StatusPill value={t.status.replace(/_/g, ' ').toLowerCase()} /></td>
                  <td style={TD}>
                    {t.status === 'PENDING' ? (
                      <AdminButton variant="gold" className="!px-2 !py-1 !text-xs" onClick={() => toast('Pick list coming soon.')}>Pick</AdminButton>
                    ) : (
                      <RowActionsMenu recordName={t.id} moduleHref="/dashboard/wms/transfers" recordId={t.id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassTable>
    </div>
  )
}

// ─── Root ──────────────────────────────────────────────────────────────────────
const PANELS: Record<string, () => React.ReactNode> = {
  '/dashboard/wms/overview':        WmsOverviewPanel,
  '/dashboard/wms/warehouses':      WarehousesPanel,
  '/dashboard/wms/stock-movements': StockMovementsPanel,
  '/dashboard/wms/transfers':       StockTransfersPanel,
}

export function WmsModulePanel(props: ModuleContextProps) {
  const Panel = PANELS[props.moduleHref]
  return renderModuleSubPanel(Panel, props)
}
