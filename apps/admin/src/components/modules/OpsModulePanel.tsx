'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import toast from 'react-hot-toast'
import { Building2, Calendar, ClipboardList, FileText, Headphones, MessageCircle, Package, RefreshCw, Truck, Users, Wifi } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import { ProcurementSubNav, ProductionSubNav } from '@/components/operations/ProcurementProductionNav'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import {
  useCustomers, useOrders, useSettings, useProcurementOverview,
  useHelpdeskOverview, useCompanyOverview, useProductionOverview,
  useDeliveryOverview, useCreateSupplier, useCreateSupportTicket,
} from '@/lib/api/hooks'
import { formatRelativeTime } from '@/lib/api/orders'
import { formatBDT } from '@/lib/utils/currency'

// ─── Design tokens ─────────────────────────────────────────────────────────────
const GOLD = '#5E7CFF'
const GOLD_LIGHT = 'rgba(200,169,126,0.10)'
const GOLD_BORDER = 'rgba(200,169,126,0.32)'


const TH: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }
const TD: React.CSSProperties = { padding: '11px 16px', fontSize: 13, color: 'var(--admin-text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.4)' }

// ─── Shared components ─────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { bg: string; text: string; border: string }> = {
  active:     { bg: 'rgba(22,163,74,0.10)',   text: '#15803D', border: 'rgba(22,163,74,0.30)' },
  success:    { bg: 'rgba(22,163,74,0.10)',   text: '#15803D', border: 'rgba(22,163,74,0.30)' },
  processing: { bg: 'rgba(59,130,246,0.10)',  text: '#1D4ED8', border: 'rgba(59,130,246,0.30)' },
  draft:      { bg: 'rgba(245,158,11,0.10)',  text: '#B45309', border: 'rgba(245,158,11,0.30)' },
  pending:    { bg: 'rgba(245,158,11,0.10)',  text: '#B45309', border: 'rgba(245,158,11,0.30)' },
  inactive:   { bg: 'rgba(156,163,175,0.10)', text: '#4B5563', border: 'rgba(156,163,175,0.30)' },
  cancelled:  { bg: 'rgba(239,68,68,0.10)',   text: '#B91C1C', border: 'rgba(239,68,68,0.30)' },
}

function StatusPill({ value }: { value: string }) {
  const fallback = { bg: 'rgba(156,163,175,0.10)', text: '#4B5563', border: 'rgba(156,163,175,0.30)' }
  const s = STATUS_MAP[value.toLowerCase()] ?? fallback
  return <span style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text, borderRadius: 8, padding: '2px 10px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{value}</span>
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const accentColor = accent === 'gold' ? GOLD : accent === 'success' ? '#16A34A' : accent === 'warning' ? '#D97706' : '#6366F1'
  const accentBg = accent === 'gold' ? GOLD_LIGHT : accent === 'success' ? 'rgba(22,163,74,0.08)' : accent === 'warning' ? 'rgba(217,119,6,0.08)' : 'rgba(99,102,241,0.08)'
  return (
    <div className="settings-card admin-panel-glass-subtle" style={{ padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)` }} />
      <div style={{ width: 26, height: 26, borderRadius: 7, background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor }} />
      </div>
      <p style={{ fontSize: 18, fontWeight: 900, color: 'var(--admin-text-primary)', lineHeight: 1, margin: 0 }}>{value}</p>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4, marginBottom: 0 }}>{label}</p>
    </div>
  )
}

function KpiRow({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 10, marginBottom: 20 }}>
      {items.map(([label, value]) => <KpiCard key={label} label={label} value={value} />)}
    </div>
  )
}

function EmptyState({ icon: Icon, title, hint, action }: { icon: React.ElementType; title: string; hint: string; action?: { label: string; href: string } }) {
  return (
    <div className="settings-card admin-panel-glass-subtle" style={{ padding: '40px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 52, height: 52, borderRadius: 15, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon style={{ width: 22, height: 22, color: GOLD }} strokeWidth={1.6} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 900, color: 'var(--admin-text-primary)', margin: 0 }}>{title}</p>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)', maxWidth: 360, lineHeight: 1.5, margin: 0 }}>{hint}</p>
      {action && (
        <a href={action.href} style={{ background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, color: '#8B6914', borderRadius: 10, padding: '7px 18px', fontSize: 12, fontWeight: 800, textDecoration: 'none', marginTop: 4 }}>
          {action.label}
        </a>
      )}
    </div>
  )
}

function ErrorBanner({ msg }: { msg?: string }) {
  return <div className="settings-card admin-panel-glass-subtle" style={{ padding: '12px 16px', borderLeft: '3px solid #EF4444', color: '#B91C1C', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{msg ?? 'API offline — start pnpm dev:api'}</div>
}

function GlassTable({ title, icon: Icon, footer, children }: { title: string; icon?: React.ElementType; footer?: React.ReactNode; children: React.ReactNode }) {
  const I = Icon ?? Package
  return (
    <div className="settings-card admin-panel-glass" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <I style={{ width: 13, height: 13, color: GOLD }} />
        </div>
        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--admin-text-primary)', flex: 1, margin: 0 }}>{title}</p>
        {footer}
      </div>
      <div style={{ overflowX: 'auto' }}>{children}</div>
    </div>
  )
}

function GoldBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ background: disabled ? 'rgba(156,163,175,0.10)' : GOLD_LIGHT, border: `1px solid ${disabled ? 'rgba(156,163,175,0.30)' : GOLD_BORDER}`, color: disabled ? '#9CA3AF' : '#8B6914', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
      {children}
    </button>
  )
}

function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.8)', color: 'var(--admin-text-secondary)', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
      {children}
    </button>
  )
}

// ─── Live Chat ─────────────────────────────────────────────────────────────────
function LiveChatPanel() {
  const { data: settings } = useSettings()
  const { data: customersData, isError, isLoading } = useCustomers({ limit: 30 })
  const recent = useMemo(() => {
    const list = customersData?.customers ?? []
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    return list.filter((c) => new Date(c.createdAt).getTime() >= weekAgo)
  }, [customersData?.customers])
  const customers = customersData?.customers ?? []
  const whatsapp = settings?.contact?.whatsapp ?? settings?.store?.phone

  if (isError) return <ErrorBanner />

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <KpiRow items={[['Live chats', '0'], ['Recent contacts', String(recent.length)], ['WhatsApp', whatsapp ? 'Configured' : 'Not set'], ['Total customers', String(customers.length)]]} />
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
        <div className="settings-card admin-panel-glass" style={{ padding: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Recent customers (7d)</p>
          {isLoading ? (
            <p style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>Loading…</p>
          ) : recent.length === 0 ? (
            <EmptyState icon={MessageCircle} title="No recent contacts" hint="New signups appear here — connect WhatsApp for live chat routing." action={{ label: 'Integrations', href: '/dashboard/all-integrations' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recent.slice(0, 8).map((c) => (
                <div key={c.id} className="settings-card admin-panel-glass-subtle" style={{ padding: '8px 12px' }}>
                  <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--admin-text-primary)', margin: 0 }}>{c.firstName} {c.lastName}</p>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--admin-text-muted)', margin: 0 }}>{c.phone}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="settings-card admin-panel-glass" style={{ padding: 24, display: 'flex', flexDirection: 'column', minHeight: 320 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wifi style={{ width: 15, height: 15, color: GOLD }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--admin-text-primary)', margin: 0 }}>Conversation</p>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, textAlign: 'center' }}>
            <Headphones style={{ width: 40, height: 40, color: 'rgba(200,169,126,0.40)' }} />
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-text-secondary)', margin: 0 }}>Live chat widget not connected</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)', maxWidth: 380, lineHeight: 1.5, margin: 0 }}>
              {whatsapp ? `Route inquiries to WhatsApp ${whatsapp} until the web chat backend is enabled.` : 'Add WhatsApp in Storefront Settings for customer messaging.'}
            </p>
            <Link href="/dashboard/all-integrations" className="admin-catalog-action inline-flex items-center" style={{ padding: '7px 18px', fontSize: 12, fontWeight: 800, textDecoration: 'none', marginTop: 8  }}>
              Connect channels
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helpdesk ──────────────────────────────────────────────────────────────────
function HelpdeskPanel() {
  const { data, isError, isLoading, refetch } = useHelpdeskOverview()
  const createTicket = useCreateSupportTicket()
  const tickets = data?.tickets ?? []

  const handleCreateTicket = () => {
    const subject = window.prompt('Ticket subject')
    if (!subject?.trim()) return
    const message = window.prompt('Initial message (optional)') ?? undefined
    createTicket.mutate({ subject: subject.trim(), ...(message?.trim() ? { message: message.trim() } : {}) }, { onSuccess: () => toast.success('Support ticket created.'), onError: (e) => toast.error(e.message) })
  }

  const columns = useMemo(() => ({
    New: tickets.filter((t) => t.status === 'OPEN'),
    Assigned: tickets.filter((t) => t.status === 'PENDING'),
    Waiting: [] as typeof tickets,
    Resolved: tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED'),
  }), [tickets])

  const openCount = data?.open ?? (columns.New.length + columns.Assigned.length + columns.Waiting.length)

  if (isError) return <ErrorBanner msg="Helpdesk API offline — start pnpm dev:api." />

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <KpiRow items={[['Open tickets', String(openCount)], ['New', String(columns.New.length)], ['In progress', String(columns.Assigned.length + columns.Waiting.length)], ['Total', String(data?.total ?? tickets.length)]]} />
      {isLoading ? (
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>Loading tickets…</p>
      ) : tickets.length === 0 ? (
        <EmptyState icon={Headphones} title="No support tickets yet" hint="WhatsApp, email, and contact-form tickets sync here when customers reach out." action={{ label: 'View orders & RMA', href: '/dashboard/orders' }} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {(Object.keys(columns) as (keyof typeof columns)[]).map((col) => (
            <div key={col} className="settings-card admin-panel-glass" style={{ padding: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>{col} ({columns[col].length})</p>
              {columns[col].length === 0 ? (
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)' }}>Empty</p>
              ) : (
                columns[col].slice(0, 6).map((t) => (
                  <div key={t.id} className="settings-card admin-panel-glass-subtle" style={{ padding: '10px 12px', marginBottom: 8, borderLeft: '3px solid rgba(200,169,126,0.4)' }}>
                    <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--admin-text-primary)', margin: 0 }}>{t.subject}</p>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--admin-text-muted)', margin: '2px 0 0', textTransform: 'capitalize' }}>{t.channel.toLowerCase()} · {t.priority.toLowerCase()}</p>
                    <p style={{ fontSize: 10, color: 'var(--admin-text-muted)', margin: 0 }}>{formatRelativeTime(t.updatedAt)}</p>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <GoldBtn onClick={handleCreateTicket}>New ticket</GoldBtn>
        <GhostBtn onClick={() => void refetch()}><RefreshCw style={{ width: 12, height: 12 }} /> Refresh tickets</GhostBtn>
      </div>
    </div>
  )
}

// ─── Company Dashboard ─────────────────────────────────────────────────────────
function CompanyDashboardPanel() {
  const { data, isError, isLoading, refetch } = useCompanyOverview()
  const employees = data?.employees ?? []
  const tasks = data?.tasks ?? []
  const documents = data?.documents ?? []
  const departments = data?.departments ?? []

  if (isError) return <ErrorBanner msg="Company OS API offline." />

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <KpiRow items={[['Team members', isLoading ? '…' : String(employees.length)], ['Open tasks', isLoading ? '…' : String(tasks.length)], ['Departments', isLoading ? '…' : String(departments.length)], ['Documents', isLoading ? '…' : String(documents.length)]]} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 style={{ width: 15, height: 15, color: GOLD }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--admin-text-primary)', margin: 0 }}>Company OS</p>
          </div>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)', marginBottom: 16 }}>Live HR, tasks, and documents from the commerce-os API.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Employees', href: '/dashboard/company/employees', Icon: Users },
              { label: 'Payroll', href: '/dashboard/company/payroll', Icon: Calendar },
              { label: 'Tasks', href: '/dashboard/company/tasks', Icon: ClipboardList },
              { label: 'Documents', href: '/dashboard/company/documents', Icon: FileText },
            ].map(({ label, href, Icon }) => (
              <a key={href} href={href} className="settings-card admin-panel-glass-subtle" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', borderLeft: `3px solid ${GOLD_BORDER}` }}>
                <Icon style={{ width: 14, height: 14, color: GOLD }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--admin-text-primary)' }}>{label}</span>
              </a>
            ))}
          </div>
        </div>
        <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--admin-text-primary)', marginBottom: 14 }}>Recent tasks</p>
          {tasks.length === 0 ? (
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)' }}>No open tasks.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tasks.slice(0, 5).map((t) => (
                <div key={t.id} className="settings-card admin-panel-glass-subtle" style={{ padding: '10px 14px' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-text-primary)', margin: 0 }}>{t.title}</p>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--admin-text-muted)', margin: 0, textTransform: 'capitalize' }}>{t.status.toLowerCase()} · {t.priority.toLowerCase()}</p>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <GhostBtn onClick={() => void refetch()}><RefreshCw style={{ width: 12, height: 12 }} /> Refresh</GhostBtn>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Company lists ─────────────────────────────────────────────────────────────
function CompanyListPanel({ kind }: { kind: 'employees' | 'payroll' | 'tasks' | 'documents' }) {
  const { data, isError } = useCompanyOverview()
  const employees = data?.employees ?? []
  const tasks = data?.tasks ?? []
  const documents = data?.documents ?? []

  if (isError) return <ErrorBanner msg="Company OS API offline." />

  if (kind === 'employees') {
    return (
      <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <KpiRow items={[['Total', String(employees.length)], ['Active', String(employees.filter((e) => e.status === 'ACTIVE').length)], ['Departments', String(data?.departments.length ?? 0)], ['This month', '—']]} />
        {employees.length === 0 ? (
          <EmptyState icon={Users} title="No employees added" hint="Add team members when HR records are created in Company OS." />
        ) : (
          <GlassTable icon={Users} title={`Employees · ${employees.length}`}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['ID', 'Name', 'Position', 'Phone', 'Status'].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id}>
                    <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12, color: 'var(--admin-text-muted)' }}>{e.employeeId}</td>
                    <td style={{ ...TD, fontWeight: 700, color: 'var(--admin-text-primary)' }}>{e.firstName} {e.lastName}</td>
                    <td style={{ ...TD, fontSize: 12 }}>{e.position ?? '—'}</td>
                    <td style={{ ...TD, fontSize: 12 }}>{e.phone ?? '—'}</td>
                    <td style={TD}><StatusPill value={e.status === 'ACTIVE' ? 'active' : 'inactive'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassTable>
        )}
      </div>
    )
  }

  if (kind === 'tasks') {
    return (
      <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <KpiRow items={[['Open', String(tasks.length)], ['High priority', String(tasks.filter((t) => t.priority === 'HIGH').length)], ['Due soon', '—'], ['Done', '0']]} />
        {tasks.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Task board is empty" hint="Internal tasks appear when created in Company OS." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tasks.map((t) => (
              <div key={t.id} className="settings-card admin-panel-glass-subtle" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-text-primary)', margin: 0 }}>{t.title}</p>
                  <p style={{ fontSize: 12, color: 'var(--admin-text-muted)', margin: 0 }}>{t.dueDate ? t.dueDate.slice(0, 10) : 'No due date'}</p>
                </div>
                <StatusPill value={t.status === 'DONE' ? 'success' : 'processing'} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (kind === 'documents') {
    return (
      <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <KpiRow items={[['Total', String(documents.length)], ['Active', String(documents.length)], ['This month', '—'], ['Pending', '0']]} />
        {documents.length === 0 ? (
          <EmptyState icon={FileText} title="No documents uploaded" hint="Company documents sync from the commerce-os API." />
        ) : (
          <GlassTable icon={FileText} title={`Documents · ${documents.length}`}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Title', 'Category', 'Uploaded'].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id}>
                    <td style={{ ...TD, fontWeight: 700, color: 'var(--admin-text-primary)' }}>{d.title}</td>
                    <td style={{ ...TD, fontSize: 12 }}>{d.category ?? '—'}</td>
                    <td style={{ ...TD, fontSize: 12, color: 'var(--admin-text-muted)' }}>{formatRelativeTime(d.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassTable>
        )}
      </div>
    )
  }

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <KpiRow items={[['Payroll runs', '0'], ['Employees', String(employees.length)], ['This month', '—'], ['Pending', '0']]} />
      <EmptyState icon={Calendar} title="No payroll runs yet" hint={`${employees.length} active employees — payroll processing UI coming soon. Partner withdrawals are in Finance.`} action={{ label: 'Partner Hub', href: '/dashboard/finance/partner-accounts' }} />
    </div>
  )
}

// ─── Delivery ──────────────────────────────────────────────────────────────────
function DeliveryPanel({ kind }: { kind: 'agents' | 'assignments' }) {
  const { data: ordersData, isError: ordersError } = useOrders({ limit: 100 })
  const { data, isError, isLoading, refetch } = useDeliveryOverview()
  const orders = ordersData?.orders ?? []
  const agents = data?.agents ?? []
  const assignments = data?.assignments ?? []

  const inTransit = orders.filter((o) => o.status === 'IN_TRANSIT')
  const unassigned = orders.filter((o) => ['CONFIRMED', 'PROCESSING', 'PENDING'].includes(o.status))
  const deliveredToday = orders.filter((o) => o.status === 'DELIVERED' && new Date(o.updatedAt).toDateString() === new Date().toDateString())
  const failed = orders.filter((o) => o.status === 'CANCELLED' || o.status === 'RETURNED')
  const codCollected = orders.filter((o) => o.paymentMethod === 'CASH_ON_DELIVERY' && o.status === 'DELIVERED').reduce((s, o) => s + Number(o.total), 0)

  if (isError || ordersError) return <ErrorBanner />

  if (kind === 'agents') {
    return (
      <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <KpiRow items={[['Courier agents', String(agents.length)], ['On delivery', String(assignments.filter((a) => a.status === 'IN_TRANSIT' || a.status === 'PICKED_UP').length)], ['Awaiting pickup', String(unassigned.length)], ['COD delivered', formatBDT(codCollected)]]} />
        {agents.length === 0 ? (
          <EmptyState icon={Truck} title="No delivery agents in system" hint={`${inTransit.length} orders in transit — add riders in Company OS or book via courier hub.`} action={{ label: 'Courier hub', href: '/dashboard/courier-hub' }} />
        ) : (
          <GlassTable icon={Truck} title={`Agents · ${agents.length}`}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Name', 'Phone', 'Vehicle', 'Assignments', 'Earned', 'Status'].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id}>
                    <td style={{ ...TD, fontWeight: 700, color: 'var(--admin-text-primary)' }}>{a.name}</td>
                    <td style={{ ...TD, fontSize: 12 }}>{a.phone}</td>
                    <td style={{ ...TD, fontSize: 12 }}>{a.vehicleType ?? '—'}</td>
                    <td style={TD}>{a._count?.assignments ?? 0}</td>
                    <td style={TD}>{formatBDT(Number(a.totalEarned))}</td>
                    <td style={TD}><StatusPill value={a.isActive ? 'active' : 'inactive'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassTable>
        )}
      </div>
    )
  }

  const queue = assignments.length > 0 ? assignments : unassigned.map((o) => ({ id: o.id, orderId: o.id, status: 'UNASSIGNED', earnings: 0, updatedAt: o.updatedAt, agent: { name: '—', phone: '' }, order: { id: o.id, invoiceNumber: o.invoiceNumber, shippingName: o.shippingName, shippingCity: o.shippingCity, total: o.total, status: o.status } }))

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <KpiRow items={[['Unassigned', String(unassigned.length)], ['Out for delivery', String(inTransit.length)], ['Delivered today', String(deliveredToday.length)], ['Failed / returned', String(failed.length)]]} />
      <GlassTable icon={Package} title="Assignment queue · live API" footer={<GhostBtn onClick={() => void refetch()}><RefreshCw style={{ width: 12, height: 12 }} /> Refresh</GhostBtn>}>
        {isLoading ? (
          <p style={{ padding: '20px', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>Loading…</p>
        ) : queue.length === 0 ? (
          <EmptyState icon={Truck} title="No shipments to assign" hint="All confirmed orders are booked or delivered." action={{ label: 'View orders', href: '/dashboard/orders' }} />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Invoice', 'Customer', 'City', 'Agent', 'Total', 'Status'].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {queue.slice(0, 15).map((a) => (
                <tr key={a.id}>
                  <td style={TD}>
                    {a.order ? (
                      <a href={`/dashboard/orders/${a.order.id}`} style={{ fontWeight: 800, color: GOLD, textDecoration: 'underline', fontSize: 13 }}>{a.order.invoiceNumber}</a>
                    ) : '—'}
                  </td>
                  <td style={TD}>{a.order?.shippingName ?? '—'}</td>
                  <td style={{ ...TD, fontSize: 12 }}>{a.order?.shippingCity ?? '—'}</td>
                  <td style={{ ...TD, fontSize: 12 }}>{a.agent.name}</td>
                  <td style={TD}>{a.order ? formatBDT(Number(a.order.total)) : '—'}</td>
                  <td style={TD}><StatusPill value={a.status.toLowerCase().replace(/_/g, ' ')} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassTable>
    </div>
  )
}

// ─── Procurement ───────────────────────────────────────────────────────────────
function ProcurementShell({
  moduleHref,
  title,
  subtitle,
  children,
  statusByHref,
}: {
  moduleHref: string
  title: string
  subtitle: string
  children: React.ReactNode
  statusByHref: Record<string, 'ok' | 'warn' | 'down' | 'loading'>
}) {
  return (
    <div className="space-y-4">
      <ProcurementSubNav activeHref={moduleHref} statusByHref={statusByHref} />
      <div className="ops-page-header">
        <div>
          <p className="ops-page-header__eyebrow">Procurement</p>
          <h2 className="ops-page-header__title">{title}</h2>
          <p className="ops-page-header__sub">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function ProcurementPanel({ moduleHref }: { moduleHref: string }) {
  const { data, isError, isLoading, refetch } = useProcurementOverview()
  const createSupplier = useCreateSupplier()
  const suppliers = data?.suppliers ?? []
  const orders = data?.orders ?? []
  const grns = data?.grns ?? []
  const openPos = orders.filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status)).length

  const statusByHref: Record<string, 'ok' | 'warn' | 'down' | 'loading'> = {
    '/dashboard/procurement/overview': isLoading ? 'loading' : isError ? 'down' : 'ok',
    '/dashboard/procurement/suppliers': isLoading ? 'loading' : isError ? 'down' : 'ok',
    '/dashboard/procurement/purchase-orders': isLoading ? 'loading' : isError ? 'down' : 'ok',
    '/dashboard/procurement/goods-received': isLoading ? 'loading' : isError ? 'down' : 'ok',
  }

  const handleCreateSupplier = () => {
    const name = window.prompt('Supplier name')
    if (!name?.trim()) return
    const phone = window.prompt('Phone (optional)') ?? undefined
    const email = window.prompt('Email (optional)') ?? undefined
    createSupplier.mutate({ name: name.trim(), ...(phone?.trim() ? { phone: phone.trim() } : {}), ...(email?.trim() ? { email: email.trim() } : {}) }, { onSuccess: () => toast.success('Supplier created.'), onError: (e) => toast.error(e.message) })
  }

  if (isError) {
    return (
      <ProcurementShell moduleHref={moduleHref} title="Procurement" subtitle="API connection failed." statusByHref={statusByHref}>
        <ApiOfflineBanner message="Procurement API offline — run pnpm dev:api" />
      </ProcurementShell>
    )
  }

  if (moduleHref === '/dashboard/procurement/overview') {
    return (
      <ProcurementShell moduleHref={moduleHref} title="Procurement Hub" subtitle="Live from /commerce-os/procurement API." statusByHref={statusByHref}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            ['Suppliers', suppliers.length],
            ['Open POs', openPos],
            ['Total POs', orders.length],
            ['GRNs', grns.length],
          ].map(([label, value]) => (
            <div key={label as string} className="settings-card admin-panel-glass-subtle" style={{ padding: '16px 18px' }}>
              <p style={{ fontSize: 20, fontWeight: 900, color: 'var(--admin-text-primary)', margin: 0 }}>{value as number}</p>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--admin-text-muted)', textTransform: 'uppercase', marginTop: 4 }}>{label as string}</p>
            </div>
          ))}
        </div>
        <GhostBtn onClick={() => void refetch()}><RefreshCw style={{ width: 12, height: 12 }} /> Refresh all</GhostBtn>
      </ProcurementShell>
    )
  }

  if (moduleHref === '/dashboard/procurement/suppliers') {
    return (
      <ProcurementShell moduleHref={moduleHref} title="Suppliers" subtitle="Vendor profiles & ledger balances." statusByHref={statusByHref}>
        <KpiRow items={[['Suppliers', String(suppliers.length)], ['Active', String(suppliers.filter((s) => s.isActive).length)], ['Total due', formatBDT(suppliers.reduce((s, x) => s + Number(x.dueAmount), 0))], ['Paid', formatBDT(suppliers.reduce((s, x) => s + Number(x.paidAmount), 0))]]} />
        {suppliers.length === 0 ? (
          <EmptyState icon={Package} title="No suppliers yet" hint="Add fabric and packaging vendors to track purchase orders." action={{ label: 'Inventory', href: '/dashboard/inventory' }} />
        ) : (
          <GlassTable icon={Package} title={`Suppliers · ${suppliers.length}`}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Name', 'Phone', 'Email', 'Due', 'Paid', 'Status'].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td style={{ ...TD, fontWeight: 700, color: 'var(--admin-text-primary)' }}>{s.name}</td>
                    <td style={{ ...TD, fontSize: 12 }}>{s.phone ?? '—'}</td>
                    <td style={{ ...TD, fontSize: 12 }}>{s.email ?? '—'}</td>
                    <td style={TD}>{formatBDT(Number(s.dueAmount))}</td>
                    <td style={TD}>{formatBDT(Number(s.paidAmount))}</td>
                    <td style={TD}><StatusPill value={s.isActive ? 'active' : 'inactive'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassTable>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <GoldBtn onClick={handleCreateSupplier}>Add supplier</GoldBtn>
          <GhostBtn onClick={() => void refetch()}><RefreshCw style={{ width: 12, height: 12 }} /> Refresh suppliers</GhostBtn>
        </div>
      </ProcurementShell>
    )
  }

  if (moduleHref === '/dashboard/procurement/goods-received') {
    return (
      <ProcurementShell moduleHref={moduleHref} title="Goods Received" subtitle="GRN records from purchase orders." statusByHref={statusByHref}>
        <KpiRow items={[['GRNs', String(grns.length)], ['This month', String(grns.length)], ['Pending QC', '0'], ['Suppliers', String(suppliers.length)]]} />
        {grns.length === 0 ? (
          <EmptyState icon={Package} title="No goods received notes" hint="GRNs appear when purchase orders are received into warehouse." />
        ) : (
          <GlassTable icon={Package} title={`GRNs · ${grns.length}`}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['GRN', 'PO', 'Supplier', 'Received', 'Notes'].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {grns.map((g) => (
                  <tr key={g.id}>
                    <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12, fontWeight: 800, color: GOLD }}>{g.grnNumber}</td>
                    <td style={TD}>{g.purchaseOrder.poNumber}</td>
                    <td style={TD}>{g.purchaseOrder.supplier.name}</td>
                    <td style={{ ...TD, fontSize: 12, color: 'var(--admin-text-muted)' }}>{formatRelativeTime(g.receivedAt)}</td>
                    <td style={{ ...TD, fontSize: 12 }}>{g.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassTable>
        )}
      </ProcurementShell>
    )
  }

  return (
    <ProcurementShell moduleHref={moduleHref} title="Purchase Orders" subtitle="PO workflow & approvals." statusByHref={statusByHref}>
      <KpiRow items={[['Open POs', String(openPos)], ['Total POs', String(orders.length)], ['Suppliers', String(suppliers.length)], ['GRNs', String(grns.length)]]} />
      {isLoading ? (
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>Loading purchase orders…</p>
      ) : orders.length === 0 ? (
        <EmptyState icon={Package} title="No purchase orders" hint="Create POs when restocking from suppliers." action={{ label: 'Suppliers', href: '/dashboard/procurement/suppliers' }} />
      ) : (
        <GlassTable icon={Package} title={`Purchase orders · ${orders.length}`}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['PO', 'Supplier', 'Items', 'Total', 'Status', 'Created'].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12, fontWeight: 800, color: GOLD }}>{o.poNumber}</td>
                  <td style={TD}>{o.supplier.name}</td>
                  <td style={TD}>{o.items?.length ?? 0}</td>
                  <td style={TD}>{formatBDT(Number(o.total))}</td>
                  <td style={TD}><StatusPill value={o.status === 'COMPLETED' ? 'success' : o.status === 'CANCELLED' ? 'cancelled' : 'processing'} /></td>
                  <td style={{ ...TD, fontSize: 12, color: 'var(--admin-text-muted)' }}>{formatRelativeTime(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassTable>
      )}
      <AdminButton variant="gold" disabled className="opacity-60">Create PO — form coming soon</AdminButton>
    </ProcurementShell>
  )
}

// ─── Production ────────────────────────────────────────────────────────────────
function ProductionShell({
  moduleHref,
  title,
  subtitle,
  children,
  statusByHref,
}: {
  moduleHref: string
  title: string
  subtitle: string
  children: React.ReactNode
  statusByHref: Record<string, 'ok' | 'warn' | 'down' | 'loading'>
}) {
  return (
    <div className="space-y-4">
      <ProductionSubNav activeHref={moduleHref} statusByHref={statusByHref} />
      <div className="ops-page-header">
        <div>
          <p className="ops-page-header__eyebrow">Production</p>
          <h2 className="ops-page-header__title">{title}</h2>
          <p className="ops-page-header__sub">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function ProductionPanel({ moduleHref }: { moduleHref: string }) {
  const { data, isError, isLoading, refetch } = useProductionOverview()
  const fabrics = data?.fabrics ?? []
  const batches = data?.batches ?? []

  const statusByHref: Record<string, 'ok' | 'warn' | 'down' | 'loading'> = {
    '/dashboard/production/overview': isLoading ? 'loading' : isError ? 'down' : 'ok',
    '/dashboard/production/fabric-inventory': isLoading ? 'loading' : isError ? 'down' : 'ok',
  }

  if (isError) {
    return (
      <ProductionShell moduleHref={moduleHref} title="Production" subtitle="API connection failed." statusByHref={statusByHref}>
        <ApiOfflineBanner message="Production API offline — run pnpm dev:api" />
      </ProductionShell>
    )
  }

  if (moduleHref === '/dashboard/production/fabric-inventory') {
    return (
      <ProductionShell moduleHref={moduleHref} title="Fabric Inventory" subtitle="Fabric rolls & usage from API." statusByHref={statusByHref}>
        <KpiRow items={[['Fabric types', String(fabrics.length)], ['Total meters', fabrics.reduce((s, f) => s + Number(f.quantity), 0).toFixed(1)], ['Batches', String(batches.length)], ['In production', String(batches.filter((b) => !['READY', 'CANCELLED'].includes(b.status)).length)]]} />
        {fabrics.length === 0 ? (
          <EmptyState icon={Package} title="No fabric inventory" hint="Fabric rolls are tracked in the production module." action={{ label: 'WMS', href: '/dashboard/wms/overview' }} />
        ) : (
          <GlassTable icon={Package} title={`Fabric inventory · ${fabrics.length}`}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Fabric', 'Color', 'Qty', 'Unit', 'Cost/unit'].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {fabrics.map((f) => (
                  <tr key={f.id}>
                    <td style={{ ...TD, fontWeight: 700, color: 'var(--admin-text-primary)' }}>{f.name}</td>
                    <td style={{ ...TD, fontSize: 12 }}>{f.color ?? '—'}</td>
                    <td style={{ ...TD, fontWeight: 800 }}>{Number(f.quantity)}</td>
                    <td style={{ ...TD, fontSize: 12 }}>{f.unit}</td>
                    <td style={TD}>{formatBDT(Number(f.costPerUnit))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassTable>
        )}
      </ProductionShell>
    )
  }

  return (
    <ProductionShell moduleHref={moduleHref} title="Production Overview" subtitle="Fashion production pipeline — live batches." statusByHref={statusByHref}>
      <KpiRow items={[['Batches', isLoading ? '…' : String(batches.length)], ['In progress', String(batches.filter((b) => !['READY', 'CANCELLED'].includes(b.status)).length)], ['Ready', String(batches.filter((b) => b.status === 'READY').length)], ['Fabric types', String(fabrics.length)]]} />
      {batches.length === 0 ? (
        <EmptyState icon={Package} title="No production batches" hint="Production orders appear when manufacturing runs are scheduled." action={{ label: 'Fabric inventory', href: '/dashboard/production/fabric-inventory' }} />
      ) : (
        <GlassTable icon={Package} title={`Batches · ${batches.length}`}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Product', 'Qty', 'Status', 'Created'].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td style={{ ...TD, fontWeight: 700, color: 'var(--admin-text-primary)' }}>{b.productName}</td>
                  <td style={TD}>{b.quantity}</td>
                  <td style={TD}><StatusPill value={b.status === 'READY' ? 'success' : 'processing'} /></td>
                  <td style={{ ...TD, fontSize: 12, color: 'var(--admin-text-muted)' }}>{formatRelativeTime(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassTable>
      )}
      <GhostBtn onClick={() => void refetch()}><RefreshCw style={{ width: 12, height: 12 }} /> Refresh</GhostBtn>
    </ProductionShell>
  )
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export function OpsModulePanel({ moduleHref, navItem }: ModuleContextProps) {
  if (moduleHref === '/dashboard/support/live-chat') return <LiveChatPanel />
  if (moduleHref === '/dashboard/support/helpdesk') return <HelpdeskPanel />
  if (moduleHref === '/dashboard/company/dashboard') return <CompanyDashboardPanel />
  if (moduleHref === '/dashboard/company/employees') return <CompanyListPanel kind="employees" />
  if (moduleHref === '/dashboard/company/payroll') return <CompanyListPanel kind="payroll" />
  if (moduleHref === '/dashboard/company/tasks') return <CompanyListPanel kind="tasks" />
  if (moduleHref === '/dashboard/company/documents') return <CompanyListPanel kind="documents" />
  if (moduleHref === '/dashboard/delivery/agents') return <DeliveryPanel kind="agents" />
  if (moduleHref === '/dashboard/delivery/assignments') return <DeliveryPanel kind="assignments" />
  if (moduleHref.startsWith('/dashboard/procurement/')) return <ProcurementPanel moduleHref={moduleHref} />
  if (moduleHref.startsWith('/dashboard/production/')) return <ProductionPanel moduleHref={moduleHref} />

  return (
    <EmptyState
      icon={Building2}
      title={navItem.label}
      hint="This operations module is configured — connect data sources to see live records."
    />
  )
}
