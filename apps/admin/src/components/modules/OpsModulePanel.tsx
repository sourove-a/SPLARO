'use client'

import { useMemo, useState } from 'react'
import { Building2, Calendar, ClipboardList, FileText, Headphones, MessageCircle, Package, RefreshCw, Truck, Users, Wifi } from 'lucide-react'
import { AdminButton, AdminLinkButton } from '@/components/ui/AdminButton'
import { ProcurementSubNav, ProductionSubNav } from '@/components/operations/ProcurementProductionNav'
import { ApiOfflineBanner, ApiOfflineHint } from '@/components/modules/PlatformUi'
import { ModuleLiveStrip } from '@/components/ui/connection/ModuleLiveStrip'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { toastFail } from '@/lib/admin/feedback'
import {
  confirmCompanyTaskCreated,
  confirmCompanyTaskStatusUpdated,
  confirmDeliveryAgentActiveUpdated,
  confirmDeliveryAgentCreated,
  confirmDeliveryAssignmentStatusUpdated,
  confirmEmployeeCreated,
  confirmEmployeeDeactivated,
  confirmEmployeeUpdated,
  confirmFabricCreated,
  confirmFabricStockUpdated,
  confirmGoodsGrnReceived,
  confirmHelpdeskReplySaved,
  confirmOrderAssigned,
  confirmPayrollRunCreated,
  confirmProductionBatchCreated,
  confirmProductionBatchStatusUpdated,
  confirmPurchaseOrderCreated,
  confirmSupplierCreated,
  confirmSupportTicketCreated,
} from '@/lib/admin/ops-save'
import {
  useCustomers, useOrders, useSettings, useProcurementOverview,
  useHelpdeskOverview, useCompanyOverview, useProductionOverview,
  useReplyHelpdeskTicket,
  useDeliveryOverview, useCreateSupplier, useCreateSupportTicket, useCreatePurchaseOrder,
  useReceiveGoodsGrn,
  useCreateDeliveryAgent, useUpdateDeliveryAgent, useAssignOrderToAgent, useUpdateDeliveryAssignmentStatus,
  useCreateEmployee, useUpdateEmployee, useDeactivateEmployee, useCreateCompanyTask, useUpdateCompanyTaskStatus,
  usePayrollRuns, useCreatePayrollRun,
  useCreateFabricInventory, useUpdateFabricStock, useCreateProductionBatch, useUpdateProductionBatchStatus,
} from '@/lib/api/hooks'
import { useTelegramIntegration } from '@/lib/api/integration-hooks'
import { formatRelativeTime } from '@/lib/api/orders'
import { formatBDT } from '@/lib/utils/currency'

// ─── Design tokens ─────────────────────────────────────────────────────────────
const GOLD = '#c8a97e'
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
        <AdminLinkButton href={action.href} variant="gold" size="sm" className="mt-1">
          {action.label}
        </AdminLinkButton>
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
    <AdminButton variant="gold" size="sm" onClick={onClick} disabled={disabled}>
      {children}
    </AdminButton>
  )
}

function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <AdminButton variant="ghost" size="sm" onClick={onClick}>
      {children}
    </AdminButton>
  )
}

// ─── Live Chat ─────────────────────────────────────────────────────────────────
function LiveChatPanel() {
  const { data: settings } = useSettings()
  const { data: customersData, isError, isLoading, refetch: refetchCustomers } = useCustomers({ limit: 30 })
  const { data: telegram, isError: tgError } = useTelegramIntegration()
  const recent = useMemo(() => {
    const list = customersData?.customers ?? []
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    return list.filter((c) => new Date(c.createdAt).getTime() >= weekAgo)
  }, [customersData?.customers])
  const customers = customersData?.customers ?? []
  const whatsapp = settings?.contact?.whatsapp ?? settings?.store?.phone
  const tgLive = Boolean(telegram?.isEnabled && telegram?.tokenConfigured && telegram?.chatId)
  const customersOffline = isError

  const refreshAll = () => {
    void refetchCustomers()
  }

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ModuleLiveStrip
        onRefresh={refreshAll}
        refreshing={isLoading}
        items={[
          {
            label: 'Customers API',
            value: isLoading ? '…' : customersOffline ? 'Unavailable' : `${customers.length} profiles`,
            ok: !customersOffline,
            hint: 'GET /admin/customers',
          },
          {
            label: 'WhatsApp',
            value: whatsapp ? 'Configured' : 'Not set',
            ok: Boolean(whatsapp),
            hint: whatsapp ?? 'Settings → Contact',
          },
          {
            label: 'Telegram bot',
            value: tgError ? 'Unknown' : tgLive ? 'Connected' : 'Not connected',
            ok: tgLive && !tgError,
            hint: '/dashboard/settings?section=notifications#telegram',
          },
          {
            label: 'Web chat',
            value: 'Not connected',
            ok: false,
            hint: 'Route via WhatsApp/Telegram for now',
          },
        ]}
      />
      {customersOffline ? (
        <ApiOfflineHint message="Customers API offline — recent contacts list empty until pnpm dev:api runs." />
      ) : null}
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
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-text-secondary)', margin: 0 }}>
              {tgLive
                ? 'Telegram bot is connected — order alerts route to your chat.'
                : whatsapp
                  ? `Route inquiries to WhatsApp ${whatsapp} until web chat is enabled.`
                  : 'Add WhatsApp in Storefront Settings or connect Telegram for customer messaging.'}
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
            <AdminLinkButton href="/dashboard/settings?section=notifications#telegram" variant="ghost" size="sm">
              Telegram bot
            </AdminLinkButton>
            <AdminLinkButton href="/dashboard/all-integrations" variant="ghost" size="sm">
              All integrations
            </AdminLinkButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helpdesk ──────────────────────────────────────────────────────────────────
function HelpdeskPanel() {
  const { data, isOffline, isLoading, refetch, isFetching } = useHelpdeskOverview()
  const { data: telegram } = useTelegramIntegration()
  const createTicket = useCreateSupportTicket()
  const replyTicket = useReplyHelpdeskTicket()
  const tickets = useMemo(() => data?.tickets ?? [], [data])

  const handleReply = async (ticketId: string, subject: string) => {
    if (isOffline) {
      toastFail('Helpdesk API offline.')
      return
    }
    const message = window.prompt(`Reply to: ${subject}`)
    if (!message?.trim()) return
    const ok = await confirmHelpdeskReplySaved(ticketId, message.trim(), () =>
      replyTicket.mutateAsync({ ticketId, message: message.trim() }),
    )
    if (ok) void refetch()
  }

  const handleCreateTicket = async () => {
    if (isOffline) {
      toastFail('Helpdesk API offline — start pnpm dev:api first.')
      return
    }
    const subject = window.prompt('Ticket subject')
    if (!subject?.trim()) return
    const message = window.prompt('Initial message (optional)') ?? undefined
    const created = await confirmSupportTicketCreated({ subject: subject.trim() }, () =>
      createTicket.mutateAsync({
        subject: subject.trim(),
        ...(message?.trim() ? { message: message.trim() } : {}),
      }),
    )
    if (created) void refetch()
  }

  const columns = useMemo(() => ({
    New: tickets.filter((t) => t.status === 'OPEN'),
    Assigned: tickets.filter((t) => t.status === 'PENDING'),
    Waiting: [] as typeof tickets,
    Resolved: tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED'),
  }), [tickets])

  const openCount = data?.open ?? (columns.New.length + columns.Assigned.length + columns.Waiting.length)
  const tgLive = Boolean(telegram?.isEnabled && telegram?.tokenConfigured)

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ModuleLiveStrip
        onRefresh={() => void refetch()}
        refreshing={isFetching}
        items={[
          {
            label: 'Helpdesk API',
            value: isLoading ? '…' : isOffline ? 'Unavailable' : `${data.total} ticket(s)`,
            ok: !isOffline,
            hint: 'GET /commerce-os/helpdesk/overview',
          },
          {
            label: 'Open queue',
            value: String(openCount),
            ok: !isOffline,
            hint: 'OPEN + PENDING statuses',
          },
          {
            label: 'Manual ticket',
            value: isOffline ? 'Disabled' : 'Ready',
            ok: !isOffline,
            hint: 'POST /admin/hub/support/tickets',
          },
          {
            label: 'Telegram alerts',
            value: tgLive ? 'Connected' : 'Not set',
            ok: tgLive,
            hint: 'Order + support notifications',
          },
        ]}
      />
      {isOffline ? (
        <ApiOfflineHint message="Helpdesk API offline — ticket board empty until API is running on :4000." />
      ) : null}
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
                  <button
                    key={t.id}
                    type="button"
                    className="settings-card admin-panel-glass-subtle w-full text-left"
                    style={{ padding: '10px 12px', marginBottom: 8, borderLeft: '3px solid rgba(200,169,126,0.4)', cursor: 'pointer' }}
                    onClick={() => handleReply(t.id, t.subject)}
                  >
                    <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--admin-text-primary)', margin: 0 }}>{t.subject}</p>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--admin-text-muted)', margin: '2px 0 0', textTransform: 'capitalize' }}>{t.channel.toLowerCase()} · {t.priority.toLowerCase()}</p>
                    <p style={{ fontSize: 10, color: 'var(--admin-text-muted)', margin: 0 }}>{formatRelativeTime(t.updatedAt)} · Click to reply</p>
                  </button>
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
  const { data, isError, refetch } = useCompanyOverview()
  const createEmployee = useCreateEmployee()
  const updateEmployee = useUpdateEmployee()
  const deactivateEmployee = useDeactivateEmployee()
  const createTask = useCreateCompanyTask()
  const updateTaskStatus = useUpdateCompanyTaskStatus()
  const { data: payrollRuns = [], isLoading: payrollLoading } = usePayrollRuns()
  const createPayrollRun = useCreatePayrollRun()

  const [showEmployeeForm, setShowEmployeeForm] = useState(false)
  const [empFirst, setEmpFirst] = useState('')
  const [empLast, setEmpLast] = useState('')
  const [empPhone, setEmpPhone] = useState('')
  const [empPosition, setEmpPosition] = useState('')
  const [empSalary, setEmpSalary] = useState('')

  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
  const [editFirst, setEditFirst] = useState('')
  const [editLast, setEditLast] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editPosition, setEditPosition] = useState('')
  const [editSalary, setEditSalary] = useState('')

  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskPriority, setTaskPriority] = useState('MEDIUM')

  const employees = data?.employees ?? []
  const tasks = data?.tasks ?? []
  const documents = data?.documents ?? []

  const handleCreateEmployee = async () => {
    if (!empFirst.trim() || !empLast.trim()) {
      toastFail('First and last name are required.')
      return
    }
    const created = await confirmEmployeeCreated(
      {
        firstName: empFirst.trim(),
        lastName: empLast.trim(),
        ...(empPhone.trim() ? { phone: empPhone.trim() } : {}),
        ...(empPosition.trim() ? { position: empPosition.trim() } : {}),
      },
      () =>
        createEmployee.mutateAsync({
          firstName: empFirst.trim(),
          lastName: empLast.trim(),
          ...(empPhone.trim() ? { phone: empPhone.trim() } : {}),
          ...(empPosition.trim() ? { position: empPosition.trim() } : {}),
          ...(empSalary ? { salary: Number(empSalary) || 0 } : {}),
        }),
    )
    if (!created) return
    setShowEmployeeForm(false)
    setEmpFirst('')
    setEmpLast('')
    setEmpPhone('')
    setEmpPosition('')
    setEmpSalary('')
    void refetch()
  }

  const handleDeactivate = async (id: string, name: string) => {
    if (!window.confirm(`Deactivate ${name}?`)) return
    const ok = await confirmEmployeeDeactivated(id, () => deactivateEmployee.mutateAsync(id))
    if (ok) void refetch()
  }

  const startEditEmployee = (id: string, firstName: string, lastName: string, phone: string | null, position: string | null, salary: unknown) => {
    setEditingEmployeeId(id)
    setEditFirst(firstName)
    setEditLast(lastName)
    setEditPhone(phone ?? '')
    setEditPosition(position ?? '')
    setEditSalary(salary != null ? String(salary) : '')
    setShowEmployeeForm(false)
  }

  const handleUpdateEmployee = async () => {
    if (!editingEmployeeId) return
    if (!editFirst.trim() || !editLast.trim()) {
      toastFail('First and last name are required.')
      return
    }
    const ok = await confirmEmployeeUpdated(
      editingEmployeeId,
      {
        firstName: editFirst.trim(),
        lastName: editLast.trim(),
        ...(editPhone.trim() ? { phone: editPhone.trim() } : {}),
        ...(editPosition.trim() ? { position: editPosition.trim() } : {}),
      },
      () =>
        updateEmployee.mutateAsync({
          id: editingEmployeeId,
          firstName: editFirst.trim(),
          lastName: editLast.trim(),
          ...(editPhone.trim() ? { phone: editPhone.trim() } : {}),
          ...(editPosition.trim() ? { position: editPosition.trim() } : {}),
          ...(editSalary ? { salary: Number(editSalary) || 0 } : {}),
        }),
    )
    if (!ok) return
    setEditingEmployeeId(null)
    void refetch()
  }

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) {
      toastFail('Task title is required.')
      return
    }
    const created = await confirmCompanyTaskCreated(
      { title: taskTitle.trim(), priority: taskPriority },
      () => createTask.mutateAsync({ title: taskTitle.trim(), priority: taskPriority }),
    )
    if (!created) return
    setShowTaskForm(false)
    setTaskTitle('')
    void refetch()
  }

  const handleTaskStatus = async (id: string, status: string) => {
    const ok = await confirmCompanyTaskStatusUpdated(id, status, () =>
      updateTaskStatus.mutateAsync({ id, status }),
    )
    if (ok) void refetch()
  }

  const handleCreatePayroll = async () => {
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()
    await confirmPayrollRunCreated(month, year, () => createPayrollRun.mutateAsync({ month, year }))
  }

  if (isError) return <ErrorBanner msg="Company OS API offline." />

  if (kind === 'employees') {
    return (
      <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <KpiRow items={[['Total', String(employees.length)], ['Active', String(employees.filter((e) => e.status === 'ACTIVE').length)], ['Departments', String(data?.departments.length ?? 0)], ['This month', '—']]} />
        {showEmployeeForm ? (
          <div className="admin-module-section">
            <h4 className="admin-module-section__title">New employee</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <input className="admin-input admin-input--premium" placeholder="First name" value={empFirst} onChange={(e) => setEmpFirst(e.target.value)} />
              <input className="admin-input admin-input--premium" placeholder="Last name" value={empLast} onChange={(e) => setEmpLast(e.target.value)} />
              <input className="admin-input admin-input--premium" placeholder="Phone" value={empPhone} onChange={(e) => setEmpPhone(e.target.value)} />
              <input className="admin-input admin-input--premium" placeholder="Position" value={empPosition} onChange={(e) => setEmpPosition(e.target.value)} />
              <input className="admin-input admin-input--premium" placeholder="Salary (BDT)" value={empSalary} onChange={(e) => setEmpSalary(e.target.value)} />
            </div>
            <div className="mt-3 flex gap-2">
              <AdminButton variant="gold" loading={createEmployee.isPending} onClick={() => void handleCreateEmployee()}>Save employee</AdminButton>
              <AdminButton variant="ghost" onClick={() => setShowEmployeeForm(false)}>Cancel</AdminButton>
            </div>
          </div>
        ) : null}
        {editingEmployeeId ? (
          <div className="admin-module-section">
            <h4 className="admin-module-section__title">Edit employee</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <input className="admin-input admin-input--premium" placeholder="First name" value={editFirst} onChange={(e) => setEditFirst(e.target.value)} />
              <input className="admin-input admin-input--premium" placeholder="Last name" value={editLast} onChange={(e) => setEditLast(e.target.value)} />
              <input className="admin-input admin-input--premium" placeholder="Phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              <input className="admin-input admin-input--premium" placeholder="Position" value={editPosition} onChange={(e) => setEditPosition(e.target.value)} />
              <input className="admin-input admin-input--premium" placeholder="Salary (BDT)" value={editSalary} onChange={(e) => setEditSalary(e.target.value)} />
            </div>
            <div className="mt-3 flex gap-2">
              <AdminButton variant="gold" loading={updateEmployee.isPending} onClick={() => void handleUpdateEmployee()}>Save changes</AdminButton>
              <AdminButton variant="ghost" onClick={() => setEditingEmployeeId(null)}>Cancel</AdminButton>
            </div>
          </div>
        ) : null}
        {employees.length === 0 ? (
          <EmptyState icon={Users} title="No employees added" hint="Add team members with the form below — saved to the database via API." />
        ) : (
          <GlassTable icon={Users} title={`Employees · ${employees.length}`}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['ID', 'Name', 'Position', 'Phone', 'Status', ''].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id}>
                    <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12, color: 'var(--admin-text-muted)' }}>{e.employeeId}</td>
                    <td style={{ ...TD, fontWeight: 700, color: 'var(--admin-text-primary)' }}>{e.firstName} {e.lastName}</td>
                    <td style={{ ...TD, fontSize: 12 }}>{e.position ?? '—'}</td>
                    <td style={{ ...TD, fontSize: 12 }}>{e.phone ?? '—'}</td>
                    <td style={TD}><StatusPill value={e.status === 'ACTIVE' ? 'active' : 'inactive'} /></td>
                    <td style={TD}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {e.status === 'ACTIVE' ? (
                          <>
                            <AdminButton variant="ghost" size="sm" onClick={() => startEditEmployee(e.id, e.firstName, e.lastName, e.phone, e.position, e.salary)}>Edit</AdminButton>
                            <AdminButton variant="ghost" size="sm" loading={deactivateEmployee.isPending} onClick={() => void handleDeactivate(e.id, `${e.firstName} ${e.lastName}`)}>Deactivate</AdminButton>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassTable>
        )}
        <GoldBtn onClick={() => setShowEmployeeForm(true)}>Add employee</GoldBtn>
      </div>
    )
  }

  if (kind === 'tasks') {
    return (
      <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <KpiRow items={[['Open', String(tasks.length)], ['High priority', String(tasks.filter((t) => t.priority === 'HIGH').length)], ['Due soon', '—'], ['Done', '0']]} />
        {showTaskForm ? (
          <div className="admin-module-section">
            <h4 className="admin-module-section__title">New task</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input className="admin-input admin-input--premium sm:col-span-2" placeholder="Task title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
              <select className="admin-input admin-input--premium" value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}>
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
                  <option key={p} value={p}>{p.toLowerCase()}</option>
                ))}
              </select>
            </div>
            <div className="mt-3 flex gap-2">
              <AdminButton variant="gold" loading={createTask.isPending} onClick={() => void handleCreateTask()}>Save task</AdminButton>
              <AdminButton variant="ghost" onClick={() => setShowTaskForm(false)}>Cancel</AdminButton>
            </div>
          </div>
        ) : null}
        {tasks.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Task board is empty" hint="Create internal tasks — saved via POST /commerce-os/company/tasks." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tasks.map((t) => (
              <div key={t.id} className="settings-card admin-panel-glass-subtle" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-text-primary)', margin: 0 }}>{t.title}</p>
                  <p style={{ fontSize: 12, color: 'var(--admin-text-muted)', margin: 0 }}>{t.dueDate ? t.dueDate.slice(0, 10) : 'No due date'} · {t.priority.toLowerCase()}</p>
                </div>
                <select
                  className="admin-input admin-input--premium text-xs"
                  value={t.status}
                  onChange={(e) => void handleTaskStatus(t.id, e.target.value)}
                  disabled={updateTaskStatus.isPending}
                >
                  {['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED'].map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
        <GoldBtn onClick={() => setShowTaskForm(true)}>Add task</GoldBtn>
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
        <AdminButton variant="ghost" disabled title="Backend not connected — document upload API not available">
          Upload document
        </AdminButton>
      </div>
    )
  }

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <KpiRow items={[['Payroll runs', payrollLoading ? '…' : String(payrollRuns.length)], ['Employees', String(employees.length)], ['This month', payrollRuns.some((r) => r.month === new Date().getMonth() + 1 && r.year === new Date().getFullYear()) ? 'Created' : '—'], ['Pending', String(payrollRuns.filter((r) => r.status === 'DRAFT').length)]]} />
      {payrollRuns.length === 0 ? (
        <EmptyState icon={Calendar} title="No payroll runs yet" hint={`${employees.filter((e) => e.status === 'ACTIVE').length} active employees — create a draft payroll run for this month.`} />
      ) : (
        <GlassTable icon={Calendar} title={`Payroll runs · ${payrollRuns.length}`}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Period', 'Status', 'Total', 'Employees', 'Created'].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {payrollRuns.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...TD, fontWeight: 700 }}>{r.month}/{r.year}</td>
                  <td style={TD}><StatusPill value={r.status === 'PAID' ? 'success' : 'processing'} /></td>
                  <td style={TD}>{formatBDT(Number(r.total))}</td>
                  <td style={TD}>{r._count?.items ?? '—'}</td>
                  <td style={{ ...TD, fontSize: 12, color: 'var(--admin-text-muted)' }}>{formatRelativeTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassTable>
      )}
      <GoldBtn onClick={() => void handleCreatePayroll()} disabled={createPayrollRun.isPending || employees.filter((e) => e.status === 'ACTIVE').length === 0}>
        {createPayrollRun.isPending ? 'Creating…' : 'Create this month payroll run'}
      </GoldBtn>
      <AdminButton variant="ghost" disabled title="Backend not connected — payroll approve/pay API not available">
        Approve / pay run
      </AdminButton>
    </div>
  )
}

// ─── Delivery ──────────────────────────────────────────────────────────────────
function DeliveryPanel({ kind }: { kind: 'agents' | 'assignments' }) {
  const { data: ordersData, isError: ordersError } = useOrders({ limit: 100 })
  const { data, isError, isLoading, refetch } = useDeliveryOverview()
  const createAgent = useCreateDeliveryAgent()
  const updateAgent = useUpdateDeliveryAgent()
  const assignOrder = useAssignOrderToAgent()
  const updateAssignment = useUpdateDeliveryAssignmentStatus()

  const [showAgentForm, setShowAgentForm] = useState(false)
  const [agentName, setAgentName] = useState('')
  const [agentPhone, setAgentPhone] = useState('')
  const [agentVehicle, setAgentVehicle] = useState('')

  const [assignOrderId, setAssignOrderId] = useState('')
  const [assignAgentId, setAssignAgentId] = useState('')

  const orders = ordersData?.orders ?? []
  const agents = data?.agents ?? []
  const assignments = data?.assignments ?? []

  const inTransit = orders.filter((o) => o.status === 'IN_TRANSIT')
  const unassigned = orders.filter((o) => ['CONFIRMED', 'PROCESSING', 'PENDING'].includes(o.status))
  const deliveredToday = orders.filter((o) => o.status === 'DELIVERED' && new Date(o.updatedAt).toDateString() === new Date().toDateString())
  const failed = orders.filter((o) => o.status === 'CANCELLED' || o.status === 'RETURNED')
  const codCollected = orders.filter((o) => o.paymentMethod === 'CASH_ON_DELIVERY' && o.status === 'DELIVERED').reduce((s, o) => s + Number(o.total), 0)

  if (isError || ordersError) return <ErrorBanner />

  const handleCreateAgent = async () => {
    if (!agentName.trim() || !agentPhone.trim()) {
      toastFail('Name and phone are required.')
      return
    }
    const phone = agentPhone.trim().replace(/\D/g, '')
    const created = await confirmDeliveryAgentCreated(
      {
        name: agentName.trim(),
        phone,
        ...(agentVehicle.trim() ? { vehicleType: agentVehicle.trim() } : {}),
      },
      () =>
        createAgent.mutateAsync({
          name: agentName.trim(),
          phone: agentPhone.trim(),
          ...(agentVehicle.trim() ? { vehicleType: agentVehicle.trim() } : {}),
        }),
    )
    if (!created) return
    setShowAgentForm(false)
    setAgentName('')
    setAgentPhone('')
    setAgentVehicle('')
    void refetch()
  }

  const handleAssign = async () => {
    if (!assignOrderId || !assignAgentId) {
      toastFail('Select an order and agent.')
      return
    }
    const ok = await confirmOrderAssigned(assignOrderId, assignAgentId, () =>
      assignOrder.mutateAsync({ orderId: assignOrderId, agentId: assignAgentId }),
    )
    if (!ok) return
    setAssignOrderId('')
    setAssignAgentId('')
    void refetch()
  }

  const handleAssignmentStatus = async (id: string, status: string) => {
    const ok = await confirmDeliveryAssignmentStatusUpdated(id, status, () =>
      updateAssignment.mutateAsync({ id, status }),
    )
    if (ok) void refetch()
  }

  const handleToggleAgent = async (id: string, isActive: boolean) => {
    const ok = await confirmDeliveryAgentActiveUpdated(id, !isActive, () =>
      updateAgent.mutateAsync({ id, isActive: !isActive }),
    )
    if (ok) void refetch()
  }

  if (kind === 'agents') {
    return (
      <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <KpiRow items={[['Courier agents', String(agents.length)], ['On delivery', String(assignments.filter((a) => a.status === 'IN_TRANSIT' || a.status === 'PICKED_UP').length)], ['Awaiting pickup', String(unassigned.length)], ['COD delivered', formatBDT(codCollected)]]} />
        {showAgentForm ? (
          <div className="admin-module-section">
            <h4 className="admin-module-section__title">New delivery agent</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <input className="admin-input admin-input--premium" placeholder="Name" value={agentName} onChange={(e) => setAgentName(e.target.value)} />
              <input className="admin-input admin-input--premium" placeholder="Phone" value={agentPhone} onChange={(e) => setAgentPhone(e.target.value)} />
              <input className="admin-input admin-input--premium" placeholder="Vehicle (bike/van)" value={agentVehicle} onChange={(e) => setAgentVehicle(e.target.value)} />
            </div>
            <div className="mt-3 flex gap-2">
              <AdminButton variant="gold" loading={createAgent.isPending} onClick={() => void handleCreateAgent()}>Save agent</AdminButton>
              <AdminButton variant="ghost" onClick={() => setShowAgentForm(false)}>Cancel</AdminButton>
            </div>
          </div>
        ) : null}
        {agents.length === 0 ? (
          <EmptyState icon={Truck} title="No delivery agents in system" hint="Add riders here — saved via POST /commerce-os/delivery/agents." action={{ label: 'Courier hub', href: '/dashboard/courier-hub' }} />
        ) : (
          <GlassTable icon={Truck} title={`Agents · ${agents.length}`}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Name', 'Phone', 'Vehicle', 'Assignments', 'Earned', 'Status', ''].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id}>
                    <td style={{ ...TD, fontWeight: 700, color: 'var(--admin-text-primary)' }}>{a.name}</td>
                    <td style={{ ...TD, fontSize: 12 }}>{a.phone}</td>
                    <td style={{ ...TD, fontSize: 12 }}>{a.vehicleType ?? '—'}</td>
                    <td style={TD}>{a._count?.assignments ?? 0}</td>
                    <td style={TD}>{formatBDT(Number(a.totalEarned))}</td>
                    <td style={TD}><StatusPill value={a.isActive ? 'active' : 'inactive'} /></td>
                    <td style={TD}>
                      <AdminButton
                        variant="ghost"
                        size="sm"
                        loading={updateAgent.isPending}
                        onClick={() => void handleToggleAgent(a.id, a.isActive)}
                      >
                        {a.isActive ? 'Deactivate' : 'Activate'}
                      </AdminButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassTable>
        )}
        <GoldBtn onClick={() => setShowAgentForm(true)}>Add agent</GoldBtn>
      </div>
    )
  }

  const queue = assignments

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <KpiRow items={[['Unassigned', String(unassigned.length)], ['Out for delivery', String(inTransit.length)], ['Delivered today', String(deliveredToday.length)], ['Failed / returned', String(failed.length)]]} />
      {agents.length > 0 && unassigned.length > 0 ? (
        <div className="admin-module-section">
          <h4 className="admin-module-section__title">Assign order to agent</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <select className="admin-input admin-input--premium" value={assignOrderId} onChange={(e) => setAssignOrderId(e.target.value)}>
              <option value="">Select order…</option>
              {unassigned.map((o) => (
                <option key={o.id} value={o.id}>{o.invoiceNumber} · {o.shippingName}</option>
              ))}
            </select>
            <select className="admin-input admin-input--premium" value={assignAgentId} onChange={(e) => setAssignAgentId(e.target.value)}>
              <option value="">Select agent…</option>
              {agents.filter((a) => a.isActive).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="mt-3">
            <AdminButton variant="gold" loading={assignOrder.isPending} onClick={() => void handleAssign()}>Assign order</AdminButton>
          </div>
        </div>
      ) : null}
      <GlassTable icon={Package} title="Assignment queue · live API" footer={<GhostBtn onClick={() => void refetch()}><RefreshCw style={{ width: 12, height: 12 }} /> Refresh</GhostBtn>}>
        {isLoading ? (
          <p style={{ padding: '20px', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>Loading…</p>
        ) : queue.length === 0 ? (
          unassigned.length > 0 ? (
            <p style={{ padding: '20px', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>
              No delivery assignments yet — {unassigned.length} order(s) awaiting agent assignment.
            </p>
          ) : (
          <EmptyState icon={Truck} title="No shipments to assign" hint="All confirmed orders are booked or delivered." action={{ label: 'View orders', href: '/dashboard/orders' }} />
          )
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Invoice', 'Customer', 'City', 'Agent', 'Total', 'Status', ''].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {queue.slice(0, 15).map((a) => (
                <tr key={a.id}>
                  <td style={TD}>
                    {a.order ? (
                      <a href={`/dashboard/orders/${a.order.invoiceNumber}`} style={{ fontWeight: 800, color: GOLD, textDecoration: 'underline', fontSize: 13 }}>{a.order.invoiceNumber}</a>
                    ) : '—'}
                  </td>
                  <td style={TD}>{a.order?.shippingName ?? '—'}</td>
                  <td style={{ ...TD, fontSize: 12 }}>{a.order?.shippingCity ?? '—'}</td>
                  <td style={{ ...TD, fontSize: 12 }}>{a.agent.name}</td>
                  <td style={TD}>{a.order ? formatBDT(Number(a.order.total)) : '—'}</td>
                  <td style={TD}><StatusPill value={a.status.toLowerCase().replace(/_/g, ' ')} /></td>
                  <td style={TD}>
                    {'status' in a && assignments.some((x) => x.id === a.id) ? (
                      <select
                        className="admin-input admin-input--premium text-xs"
                        value={a.status}
                        onChange={(e) => void handleAssignmentStatus(a.id, e.target.value)}
                        disabled={updateAssignment.isPending}
                      >
                        {['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED'].map((s) => (
                          <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>
                        ))}
                      </select>
                    ) : null}
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
  const createPurchaseOrder = useCreatePurchaseOrder()
  const receiveGrn = useReceiveGoodsGrn()
  const suppliers = data?.suppliers ?? []
  const orders = data?.orders ?? []
  const grns = data?.grns ?? []
  const openPos = orders.filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status)).length
  const pendingReceive = orders.filter((o) => !['RECEIVED', 'COMPLETED', 'CANCELLED'].includes(o.status))

  const [showCreatePo, setShowCreatePo] = useState(false)
  const [poSupplierId, setPoSupplierId] = useState('')
  const [poNotes, setPoNotes] = useState('')
  const [poItems, setPoItems] = useState([{ productName: '', sku: '', quantity: '1', unitCost: '' }])

  const poLineTotal = useMemo(
    () =>
      poItems.reduce((sum, row) => {
        const qty = Number(row.quantity) || 0
        const cost = Number(row.unitCost) || 0
        return sum + qty * cost
      }, 0),
    [poItems],
  )

  const handleCreatePo = async () => {
    if (!poSupplierId) {
      toastFail('Select a supplier first.')
      return
    }
    const items = poItems
      .map((row) => {
        const item = {
          productName: row.productName.trim(),
          quantity: Number(row.quantity) || 0,
          unitCost: Number(row.unitCost) || 0,
          ...(row.sku.trim() ? { sku: row.sku.trim() } : {}),
        }
        return item
      })
      .filter((row) => row.productName && row.quantity > 0)

    if (!items.length) {
      toastFail('Add at least one line item with name, quantity, and unit cost.')
      return
    }

    const created = await confirmPurchaseOrderCreated(poSupplierId, () =>
      createPurchaseOrder.mutateAsync({
        supplierId: poSupplierId,
        ...(poNotes.trim() ? { notes: poNotes.trim() } : {}),
        items,
      }),
    )
    if (!created) return
    setShowCreatePo(false)
    setPoSupplierId('')
    setPoNotes('')
    setPoItems([{ productName: '', sku: '', quantity: '1', unitCost: '' }])
    void refetch()
  }

  const statusByHref: Record<string, 'ok' | 'warn' | 'down' | 'loading'> = {
    '/dashboard/procurement/overview': isLoading ? 'loading' : isError ? 'down' : 'ok',
    '/dashboard/procurement/suppliers': isLoading ? 'loading' : isError ? 'down' : 'ok',
    '/dashboard/procurement/purchase-orders': isLoading ? 'loading' : isError ? 'down' : 'ok',
    '/dashboard/procurement/goods-received': isLoading ? 'loading' : isError ? 'down' : 'ok',
  }

  const handleReceiveGrn = async (purchaseOrderId: string, poNumber: string) => {
    if (!window.confirm(`Receive goods for ${poNumber}? Stock will update for line items with SKUs.`)) return
    const ok = await confirmGoodsGrnReceived(purchaseOrderId, () =>
      receiveGrn.mutateAsync({ purchaseOrderId }),
    )
    if (ok) void refetch()
  }

  const handleCreateSupplier = async () => {
    const name = window.prompt('Supplier name')
    if (!name?.trim()) return
    const phone = window.prompt('Phone (optional)') ?? undefined
    const email = window.prompt('Email (optional)') ?? undefined
    const created = await confirmSupplierCreated({ name: name.trim() }, () =>
      createSupplier.mutateAsync({
        name: name.trim(),
        ...(phone?.trim() ? { phone: phone.trim() } : {}),
        ...(email?.trim() ? { email: email.trim() } : {}),
      }),
    )
    if (created) void refetch()
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
        <KpiRow items={[['GRNs', String(grns.length)], ['Pending receive', String(pendingReceive.length)], ['Suppliers', String(suppliers.length)], ['Open POs', String(openPos)]]} />
        {pendingReceive.length > 0 ? (
          <div className="admin-module-section" style={{ marginBottom: 14 }}>
            <h4 className="admin-module-section__title">Pending receive · {pendingReceive.length}</h4>
            <p className="admin-module-section__hint" style={{ fontSize: 12, color: 'var(--admin-text-muted)', marginBottom: 8 }}>
              Full PO receive only. Variant stock increases for line items with matching product SKUs — lines without SKU are not stocked.
            </p>
            <GlassTable icon={Package} title="Purchase orders awaiting GRN">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['PO', 'Supplier', 'Items', 'Status', ''].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                <tbody>
                  {pendingReceive.map((o) => (
                    <tr key={o.id}>
                      <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12, fontWeight: 800, color: GOLD }}>{o.poNumber}</td>
                      <td style={TD}>{o.supplier.name}</td>
                      <td style={TD}>{o.items?.length ?? 0}</td>
                      <td style={TD}><StatusPill value={o.status === 'COMPLETED' ? 'success' : o.status === 'CANCELLED' ? 'cancelled' : 'processing'} /></td>
                      <td style={TD}>
                        <AdminButton variant="gold" size="sm" loading={receiveGrn.isPending} onClick={() => void handleReceiveGrn(o.id, o.poNumber)}>
                          Receive goods
                        </AdminButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </GlassTable>
          </div>
        ) : null}
        {grns.length === 0 ? (
          <EmptyState icon={Package} title="No goods received notes" hint="GRNs appear when purchase orders are received into warehouse." action={{ label: 'Purchase orders', href: '/dashboard/procurement/purchase-orders' }} />
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
            <thead><tr>{['PO', 'Supplier', 'Items', 'Total', 'Status', 'Created', ''].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12, fontWeight: 800, color: GOLD }}>{o.poNumber}</td>
                  <td style={TD}>{o.supplier.name}</td>
                  <td style={TD}>{o.items?.length ?? 0}</td>
                  <td style={TD}>{formatBDT(Number(o.total))}</td>
                  <td style={TD}><StatusPill value={o.status === 'COMPLETED' ? 'success' : o.status === 'CANCELLED' ? 'cancelled' : 'processing'} /></td>
                  <td style={{ ...TD, fontSize: 12, color: 'var(--admin-text-muted)' }}>{formatRelativeTime(o.createdAt)}</td>
                  <td style={TD}>
                    {!['RECEIVED', 'COMPLETED', 'CANCELLED'].includes(o.status) ? (
                      <AdminButton variant="gold" size="sm" loading={receiveGrn.isPending} onClick={() => void handleReceiveGrn(o.id, o.poNumber)}>
                        Receive goods
                      </AdminButton>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassTable>
      )}
      {showCreatePo ? (
        <div className="admin-module-section" style={{ marginBottom: 14 }}>
          <div className="admin-module-section__head">
            <h4 className="admin-module-section__title">New purchase order</h4>
            <p className="admin-module-section__hint">Draft PO — saved to database via POST /admin/hub/procurement/purchase-orders</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[var(--admin-text-muted)]">Supplier</span>
              <select
                className="admin-input admin-input--premium w-full"
                value={poSupplierId}
                onChange={(e) => setPoSupplierId(e.target.value)}
              >
                <option value="">Select supplier…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[var(--admin-text-muted)]">Notes (optional)</span>
              <input className="admin-input admin-input--premium w-full" value={poNotes} onChange={(e) => setPoNotes(e.target.value)} placeholder="Restock fabric for Eid collection…" />
            </label>
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--admin-text-muted)]">Line items</p>
            {poItems.map((row, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-4">
                <input className="admin-input admin-input--premium sm:col-span-2" placeholder="Product / material name" value={row.productName} onChange={(e) => setPoItems((items) => items.map((item, i) => (i === index ? { ...item, productName: e.target.value } : item)))} />
                <input className="admin-input admin-input--premium" placeholder="SKU" value={row.sku} onChange={(e) => setPoItems((items) => items.map((item, i) => (i === index ? { ...item, sku: e.target.value } : item)))} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="admin-input admin-input--premium" type="number" min={1} placeholder="Qty" value={row.quantity} onChange={(e) => setPoItems((items) => items.map((item, i) => (i === index ? { ...item, quantity: e.target.value } : item)))} />
                  <input className="admin-input admin-input--premium" type="number" min={0} step="0.01" placeholder="Unit ৳" value={row.unitCost} onChange={(e) => setPoItems((items) => items.map((item, i) => (i === index ? { ...item, unitCost: e.target.value } : item)))} />
                </div>
              </div>
            ))}
            <button
              type="button"
              className="text-xs font-bold text-[var(--admin-brand-gold-strong)] underline"
              onClick={() => setPoItems((items) => [...items, { productName: '', sku: '', quantity: '1', unitCost: '' }])}
            >
              + Add line
            </button>
          </div>
          <p className="mt-3 text-sm font-bold text-[var(--admin-text-secondary)]">
            Estimated total: {formatBDT(poLineTotal)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <GoldBtn onClick={handleCreatePo} disabled={createPurchaseOrder.isPending || suppliers.length === 0}>
              {createPurchaseOrder.isPending ? 'Creating…' : 'Create PO'}
            </GoldBtn>
            <GhostBtn onClick={() => setShowCreatePo(false)}>Cancel</GhostBtn>
            {suppliers.length === 0 ? (
              <AdminLinkButton href="/dashboard/procurement/suppliers" variant="ghost" size="sm">
                Add a supplier first →
              </AdminLinkButton>
            ) : null}
          </div>
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <GoldBtn onClick={() => setShowCreatePo(true)} disabled={suppliers.length === 0}>
          Create PO
        </GoldBtn>
        <GhostBtn onClick={() => void refetch()}><RefreshCw style={{ width: 12, height: 12 }} /> Refresh</GhostBtn>
      </div>
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
  const createFabric = useCreateFabricInventory()
  const updateFabricStock = useUpdateFabricStock()
  const createBatch = useCreateProductionBatch()
  const updateBatchStatus = useUpdateProductionBatchStatus()
  const fabrics = data?.fabrics ?? []
  const batches = data?.batches ?? []

  const [showFabricForm, setShowFabricForm] = useState(false)
  const [fabricName, setFabricName] = useState('')
  const [fabricColor, setFabricColor] = useState('')
  const [fabricQty, setFabricQty] = useState('')

  const [adjustFabricId, setAdjustFabricId] = useState<string | null>(null)
  const [fabricDelta, setFabricDelta] = useState('')

  const [showBatchForm, setShowBatchForm] = useState(false)
  const [batchName, setBatchName] = useState('')
  const [batchQty, setBatchQty] = useState('')

  const handleCreateFabric = async () => {
    if (!fabricName.trim()) {
      toastFail('Fabric name is required.')
      return
    }
    const quantity = Number(fabricQty) || 0
    const created = await confirmFabricCreated(
      {
        name: fabricName.trim(),
        ...(fabricColor.trim() ? { color: fabricColor.trim() } : {}),
        quantity,
      },
      () =>
        createFabric.mutateAsync({
          name: fabricName.trim(),
          ...(fabricColor.trim() ? { color: fabricColor.trim() } : {}),
          quantity,
        }),
    )
    if (!created) return
    setShowFabricForm(false)
    setFabricName('')
    setFabricColor('')
    setFabricQty('')
    void refetch()
  }

  const handleFabricAdjust = async () => {
    if (!adjustFabricId) return
    const delta = Number(fabricDelta)
    if (!Number.isFinite(delta) || delta === 0) {
      toastFail('Enter a non-zero delta (+ inbound, − outbound meters).')
      return
    }
    const current = fabrics.find((f) => f.id === adjustFabricId)
    const expectedQuantity = Number(current?.quantity ?? 0) + delta
    const ok = await confirmFabricStockUpdated(adjustFabricId, expectedQuantity, () =>
      updateFabricStock.mutateAsync({ id: adjustFabricId, delta }),
    )
    if (!ok) return
    setAdjustFabricId(null)
    setFabricDelta('')
    void refetch()
  }

  const handleCreateBatch = async () => {
    const qty = Number(batchQty)
    if (!batchName.trim()) {
      toastFail('Product name is required.')
      return
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      toastFail('Quantity must be a positive integer.')
      return
    }
    const created = await confirmProductionBatchCreated(
      { productName: batchName.trim(), quantity: qty },
      () => createBatch.mutateAsync({ productName: batchName.trim(), quantity: qty }),
    )
    if (!created) return
    setShowBatchForm(false)
    setBatchName('')
    setBatchQty('')
    void refetch()
  }

  const handleBatchStatus = async (id: string, status: string) => {
    const ok = await confirmProductionBatchStatusUpdated(id, status, () =>
      updateBatchStatus.mutateAsync({ id, status }),
    )
    if (ok) void refetch()
  }

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
        {showFabricForm ? (
          <div className="admin-module-section" style={{ marginBottom: 14 }}>
            <h4 className="admin-module-section__title">Add fabric</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <input className="admin-input admin-input--premium" placeholder="Name" value={fabricName} onChange={(e) => setFabricName(e.target.value)} />
              <input className="admin-input admin-input--premium" placeholder="Color" value={fabricColor} onChange={(e) => setFabricColor(e.target.value)} />
              <input className="admin-input admin-input--premium" placeholder="Quantity (meters)" value={fabricQty} onChange={(e) => setFabricQty(e.target.value)} />
            </div>
            <div className="mt-3 flex gap-2">
              <AdminButton variant="gold" loading={createFabric.isPending} onClick={() => void handleCreateFabric()}>Save fabric</AdminButton>
              <AdminButton variant="ghost" onClick={() => setShowFabricForm(false)}>Cancel</AdminButton>
            </div>
          </div>
        ) : null}
        {adjustFabricId ? (
          <div className="admin-module-section" style={{ marginBottom: 14 }}>
            <h4 className="admin-module-section__title">Adjust stock — {fabrics.find((f) => f.id === adjustFabricId)?.name ?? 'Fabric'}</h4>
            <p className="admin-module-section__hint" style={{ fontSize: 12, color: 'var(--admin-text-muted)', marginBottom: 8 }}>
              Delta in meters (+ add, − remove). Saved via PATCH /commerce-os/production/fabrics/:id/stock.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <input className="admin-input admin-input--premium w-40" placeholder="Delta (e.g. 10 or -5)" value={fabricDelta} onChange={(e) => setFabricDelta(e.target.value)} />
              <AdminButton variant="gold" loading={updateFabricStock.isPending} onClick={() => void handleFabricAdjust()}>Apply</AdminButton>
              <AdminButton variant="ghost" onClick={() => { setAdjustFabricId(null); setFabricDelta('') }}>Cancel</AdminButton>
            </div>
          </div>
        ) : null}
        {fabrics.length === 0 ? (
          <EmptyState icon={Package} title="No fabric inventory" hint="Add fabric rolls — saved via POST /commerce-os/production/fabrics." action={{ label: 'WMS', href: '/dashboard/wms/overview' }} />
        ) : (
          <GlassTable icon={Package} title={`Fabric inventory · ${fabrics.length}`}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Fabric', 'Color', 'Qty', 'Unit', 'Cost/unit', ''].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {fabrics.map((f) => (
                  <tr key={f.id}>
                    <td style={{ ...TD, fontWeight: 700, color: 'var(--admin-text-primary)' }}>{f.name}</td>
                    <td style={{ ...TD, fontSize: 12 }}>{f.color ?? '—'}</td>
                    <td style={{ ...TD, fontWeight: 800 }}>{Number(f.quantity)}</td>
                    <td style={{ ...TD, fontSize: 12 }}>{f.unit}</td>
                    <td style={TD}>{formatBDT(Number(f.costPerUnit))}</td>
                    <td style={TD}>
                      <AdminButton variant="ghost" size="sm" onClick={() => { setAdjustFabricId(f.id); setFabricDelta('') }}>Adjust</AdminButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassTable>
        )}
        <GoldBtn onClick={() => setShowFabricForm(true)}>Add fabric</GoldBtn>
      </ProductionShell>
    )
  }

  return (
    <ProductionShell moduleHref={moduleHref} title="Production Overview" subtitle="Fashion production pipeline — live batches." statusByHref={statusByHref}>
      <KpiRow items={[['Batches', isLoading ? '…' : String(batches.length)], ['In progress', String(batches.filter((b) => !['READY', 'CANCELLED'].includes(b.status)).length)], ['Ready', String(batches.filter((b) => b.status === 'READY').length)], ['Fabric types', String(fabrics.length)]]} />
      {showBatchForm ? (
        <div className="admin-module-section" style={{ marginBottom: 14 }}>
          <h4 className="admin-module-section__title">New production batch</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input className="admin-input admin-input--premium" placeholder="Product name" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
            <input className="admin-input admin-input--premium" placeholder="Quantity" value={batchQty} onChange={(e) => setBatchQty(e.target.value)} />
          </div>
          <div className="mt-3 flex gap-2">
            <AdminButton variant="gold" loading={createBatch.isPending} onClick={() => void handleCreateBatch()}>Create batch</AdminButton>
            <AdminButton variant="ghost" onClick={() => setShowBatchForm(false)}>Cancel</AdminButton>
          </div>
        </div>
      ) : null}
      {batches.length === 0 ? (
        <EmptyState icon={Package} title="No production batches" hint="Create batches via POST /commerce-os/production/batches." action={{ label: 'Fabric inventory', href: '/dashboard/production/fabric-inventory' }} />
      ) : (
        <GlassTable icon={Package} title={`Batches · ${batches.length}`}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Product', 'Qty', 'Status', 'Created', ''].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td style={{ ...TD, fontWeight: 700, color: 'var(--admin-text-primary)' }}>{b.productName}</td>
                  <td style={TD}>{b.quantity}</td>
                  <td style={TD}>
                    <select
                      className="admin-input admin-input--premium text-xs"
                      value={b.status}
                      onChange={(e) => void handleBatchStatus(b.id, e.target.value)}
                      disabled={updateBatchStatus.isPending}
                    >
                      {['PENDING', 'CUTTING', 'SEWING', 'FINISHING', 'QC', 'READY', 'CANCELLED'].map((s) => (
                        <option key={s} value={s}>{s.toLowerCase()}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ ...TD, fontSize: 12, color: 'var(--admin-text-muted)' }}>{formatRelativeTime(b.createdAt)}</td>
                  <td style={TD} />
                </tr>
              ))}
            </tbody>
          </table>
        </GlassTable>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <GoldBtn onClick={() => setShowBatchForm(true)}>Create batch</GoldBtn>
        <GhostBtn onClick={() => void refetch()}><RefreshCw style={{ width: 12, height: 12 }} /> Refresh</GhostBtn>
      </div>
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
