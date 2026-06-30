'use client'

import { useEffect, useState } from 'react'
import { KeyRound, Plus, RefreshCw, ScrollText, Search, Shield, ShieldCheck } from 'lucide-react'
import { loadAdminData, saveAdminData } from '@/lib/admin/admin-actions'
import { notifyDraftSaved, toastNotImplemented } from '@/lib/admin/feedback'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import { useSecurity } from '@/lib/api/hooks'
import { SecuritySubNav } from '@/components/security/SecuritySubNav'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'

// ─── Design tokens ──────────────────────────────────────────────────────────
const GOLD = '#5E7CFF'
const GOLD_LIGHT = 'rgba(200,169,126,0.10)'
const GOLD_BORDER = 'rgba(200,169,126,0.32)'

// ─── Types ───────────────────────────────────────────────────────────────────
type PermissionRow = { module: string; view: boolean; create: boolean; edit: boolean; delete: boolean }

const DEFAULT_PERMISSIONS: PermissionRow[] = [
  { module: 'Orders',      view: true,  create: true,  edit: true,  delete: false },
  { module: 'Products',    view: true,  create: true,  edit: true,  delete: true  },
  { module: 'Finance',     view: true,  create: false, edit: false, delete: false },
  { module: 'Admin Users', view: true,  create: false, edit: false, delete: false },
  { module: 'Settings',    view: true,  create: true,  edit: true,  delete: false },
]

const ROLE_OPTIONS = ['Super Admin', 'Admin', 'Manager', 'Staff'] as const

// ─── Shared components ────────────────────────────────────────────────────────
function KpiCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  const accentColor = accent === 'gold' ? 'var(--admin-text-secondary)' : accent === 'success' ? '#16A34A' : accent === 'warning' ? '#D97706' : '#6366F1'
  const accentBg = accent === 'success' ? 'rgba(22,163,74,0.08)' : accent === 'warning' ? 'rgba(217,119,6,0.08)' : 'rgba(99,102,241,0.08)'
  return (
    <div className="settings-card admin-panel-glass-subtle admin-module-kpi" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)` }} />
      <div style={{ width: 32, height: 32, borderRadius: 9, background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: accentColor }} />
      </div>
      <p style={{ fontSize: 22, fontWeight: 900, color: 'var(--admin-text-primary)', lineHeight: 1, margin: 0 }}>{value}</p>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4, marginBottom: 0 }}>{label}</p>
    </div>
  )
}

function PanelHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <div className="admin-module-icon-ring" style={{ width: 40, height: 40, borderRadius: 12 }}>
        <Icon style={{ width: 18, height: 18 }} strokeWidth={2} />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--admin-text-primary)', margin: 0 }}>{title}</h3>
    </div>
  )
}

function GlassSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
      <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--admin-text-muted)', pointerEvents: 'none' }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search…'}
        style={{
          width: '100%', paddingLeft: 36, paddingRight: 14, paddingTop: 9, paddingBottom: 9,
          background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.80)',
          borderRadius: 12, fontSize: 13, fontWeight: 600, color: 'var(--admin-text-primary)', outline: 'none',
        }}
      />
    </div>
  )
}

function StatusBadge({ value, ok }: { value: string; ok?: boolean }) {
  return (
    <span style={{
      background: ok ? 'rgba(22,163,74,0.10)' : 'rgba(245,158,11,0.10)',
      border: `1px solid ${ok ? 'rgba(22,163,74,0.30)' : 'rgba(245,158,11,0.30)'}`,
      color: ok ? '#15803D' : '#B45309',
      borderRadius: 8, padding: '2px 10px', fontSize: 11, fontWeight: 800,
    }}>
      {value}
    </span>
  )
}

function GoldBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="admin-catalog-action">
      {children}
    </button>
  )
}

// ─── Views ────────────────────────────────────────────────────────────────────
function AdminUsersView({ data, isLoading }: { data: ReturnType<typeof useSecurity>['data']; isLoading: boolean }) {
  const kpis = data?.kpis
  const [query, setQuery] = useState('')
  const rows = (data?.adminUsers ?? []).filter((r) =>
    r.name.toLowerCase().includes(query.toLowerCase()) || r.email.includes(query),
  )

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
        <PanelHeader icon={Shield} title="Admin Users" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <KpiCard label="Total admins"  value={isLoading ? '…' : kpis?.totalAdmins ?? 0} />
          <KpiCard label="Active"        value={isLoading ? '…' : kpis?.activeAdmins ?? 0} accent="success" />
          <KpiCard label="2FA enabled"   value={isLoading ? '…' : kpis?.twoFaEnabled ?? 0} accent="gold" />
          <KpiCard label="Sessions"      value={isLoading ? '…' : kpis?.activeSessions ?? 0} accent="warning" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <GlassSearch value={query} onChange={setQuery} placeholder="Search admin users…" />
        <GoldBtn onClick={() => toastNotImplemented('Invite admin')}>
          <Plus style={{ width: 14, height: 14 }} />
          Invite admin
        </GoldBtn>
      </div>

      <div className="settings-card admin-panel-glass" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.5)' }}>
              {['Name', 'Email', 'Role', 'Status', '2FA', 'Last login'].map((h) => (
                <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
                <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 700, color: 'var(--admin-text-primary)' }}>{row.name}</td>
                <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--admin-text-muted)' }}>{row.email}</td>
                <td style={{ padding: '12px 20px', fontSize: 12, fontWeight: 600, color: 'var(--admin-text-secondary)' }}>{row.role}</td>
                <td style={{ padding: '12px 20px' }}><StatusBadge value={row.status} ok={row.status === 'active'} /></td>
                <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 800, color: row.twoFA ? '#15803D' : '#6B7280' }}>{row.twoFA ? 'Yes' : 'No'}</td>
                <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--admin-text-muted)' }}>{row.lastLogin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RolesView({ data, isLoading }: { data: ReturnType<typeof useSecurity>['data']; isLoading: boolean }) {
  const kpis = data?.kpis
  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
        <PanelHeader icon={ShieldCheck} title="Roles" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <KpiCard label="Roles"          value={isLoading ? '…' : data?.roles.length ?? 0} />
          <KpiCard label="Assigned users" value={isLoading ? '…' : kpis?.totalAdmins ?? 0} accent="success" />
          <KpiCard label="Custom roles"   value="0" accent="gold" />
          <KpiCard label="Locked"         value="0" accent="warning" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {(data?.roles ?? []).map((r) => (
          <div key={r.id} className="settings-card admin-panel-glass" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck style={{ width: 15, height: 15, color: GOLD }} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 900, color: 'var(--admin-text-primary)', margin: 0 }}>{r.name}</p>
              </div>
              <StatusBadge value={r.status} ok={r.status === 'active'} />
            </div>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)', margin: '0 0 6px' }}>{r.users} users assigned</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-text-secondary)', margin: 0 }}>{r.permissions}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function PermissionsView() {
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]>('Manager')
  const [permRows, setPermRows] = useState<PermissionRow[]>(DEFAULT_PERMISSIONS)

  useEffect(() => {
    setPermRows(loadAdminData(`permissions:${role}`, DEFAULT_PERMISSIONS))
  }, [role])

  const togglePerm = (module: string, key: keyof Omit<PermissionRow, 'module'>) => {
    setPermRows((prev) => prev.map((row) => (row.module === module ? { ...row, [key]: !row[key] } : row)))
  }

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
        <PanelHeader icon={KeyRound} title="Permissions" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <KpiCard label="Modules"    value={permRows.length} />
          <KpiCard label="Role"       value={role} accent="gold" />
          <KpiCard label="Granted"    value={permRows.filter((r) => r.view).length} accent="success" />
          <KpiCard label="Restricted" value={permRows.filter((r) => !r.view).length} accent="warning" />
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {ROLE_OPTIONS.map((item) => (
          <button key={item} type="button" onClick={() => setRole(item)} style={{
            background: role === item ? GOLD_LIGHT : 'rgba(255,255,255,0.7)',
            border: `1px solid ${role === item ? GOLD_BORDER : 'rgba(255,255,255,0.8)'}`,
            color: role === item ? '#8B6914' : 'var(--admin-text-secondary)',
            borderRadius: 10, padding: '7px 16px', fontSize: 12, fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {item}
          </button>
        ))}
      </div>

      <div className="settings-card admin-panel-glass" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.5)' }}>
              {['Module', 'View', 'Create', 'Edit', 'Delete'].map((h) => (
                <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permRows.map((row) => (
              <tr key={row.module} style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
                <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 700, color: 'var(--admin-text-primary)' }}>{row.module}</td>
                {(['view', 'create', 'edit', 'delete'] as const).map((key) => (
                  <td key={key} style={{ padding: '12px 20px' }}>
                    <input type="checkbox" checked={row[key]} onChange={() => togglePerm(row.module, key)} style={{ width: 16, height: 16, accentColor: GOLD, cursor: 'pointer' }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <GoldBtn onClick={() => { saveAdminData(`permissions:${role}`, permRows); notifyDraftSaved(`${role} permissions`) }}>
          Save permissions
        </GoldBtn>
      </div>
    </div>
  )
}

function AuditLogsView({ data, isLoading, refetch }: { data: ReturnType<typeof useSecurity>['data']; isLoading: boolean; refetch: () => void }) {
  const kpis = data?.kpis
  const [query, setQuery] = useState('')
  const logs = (data?.auditLogs ?? []).filter((r) => r.action.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
        <PanelHeader icon={ScrollText} title="Audit Logs" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <KpiCard label="Events"          value={isLoading ? '…' : logs.length} />
          <KpiCard label="Failed logins 24h" value={isLoading ? '…' : kpis?.failedLogins24h ?? 0} accent="warning" />
          <KpiCard label="Threat level"    value={kpis?.threatLevel ?? '—'} accent={kpis?.threatLevel === 'low' ? 'success' : 'warning'} />
          <KpiCard label="Sessions"        value={isLoading ? '…' : kpis?.activeSessions ?? 0} accent="gold" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <GlassSearch value={query} onChange={setQuery} placeholder="Search audit logs…" />
        <GoldBtn onClick={refetch}>
          <RefreshCw style={{ width: 13, height: 13 }} />
          Refresh
        </GoldBtn>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {logs.map((row) => (
          <div key={row.id} className="settings-card admin-panel-glass-subtle admin-module-row" style={{ padding: '12px 16px' }}>
            <div className="admin-module-icon-ring" style={{ width: 32, height: 32, borderRadius: 9 }}>
              <ScrollText style={{ width: 13, height: 13 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--admin-text-primary)', margin: 0 }}>{row.action}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--admin-text-muted)', margin: 0 }}>
                {row.actor} · {row.target} · {row.time}
              </p>
            </div>
            <StatusBadge value={row.severity} ok={row.severity !== 'danger'} />
          </div>
        ))}
        {logs.length === 0 && !isLoading && (
          <div className="settings-card admin-panel-glass-subtle" style={{ padding: 24, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--admin-text-muted)' }}>
            No audit events yet. Actions in admin will appear here.
          </div>
        )}
      </div>
    </div>
  )
}

function SecurityCenterView({ data, isLoading }: { data: ReturnType<typeof useSecurity>['data']; isLoading: boolean }) {
  const kpis = data?.kpis
  const threatLabel = kpis?.threatLevel === 'low' ? 'Low' : kpis?.threatLevel === 'medium' ? 'Medium' : 'High'
  const twoFaCoverage = kpis?.totalAdmins
    ? `${Math.round(((kpis.twoFaEnabled ?? 0) / kpis.totalAdmins) * 100)}%`
    : '0%'

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
        <PanelHeader icon={Shield} title="Security Center" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <KpiCard label="Threat score"  value={threatLabel} accent={kpis?.threatLevel === 'low' ? 'success' : 'warning'} />
          <KpiCard label="2FA coverage"  value={twoFaCoverage} accent="warning" />
          <KpiCard label="Sessions"      value={isLoading ? '…' : kpis?.activeSessions ?? 0} />
          <KpiCard label="Blocked 24h"   value={isLoading ? '…' : kpis?.failedLogins24h ?? 0} accent="gold" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div className="admin-module-icon-ring" style={{ width: 36, height: 36 }}>
              <Shield style={{ width: 16, height: 16 }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--admin-text-primary)', margin: 0 }}>Security posture</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(data?.posture ?? []).map((item) => (
              <div key={item.label} className="settings-card admin-panel-glass-subtle" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-secondary)' }}>{item.label}</span>
                <span style={{ fontSize: 13, fontWeight: 900, color: item.ok ? '#15803D' : '#B45309' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div className="admin-module-icon-ring" style={{ width: 36, height: 36 }}>
              <KeyRound style={{ width: 16, height: 16 }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--admin-text-primary)', margin: 0 }}>Recent threats</p>
          </div>
          {(data?.threats.length ?? 0) > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data!.threats.map((row) => (
                <div key={row.id} className="settings-card admin-panel-glass-subtle" style={{ padding: '10px 14px' }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--admin-text-primary)', margin: '0 0 2px' }}>{row.action}</p>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--admin-text-muted)', margin: 0 }}>{row.time}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="settings-card admin-panel-glass-subtle" style={{ padding: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#15803D', margin: 0 }}>No threats detected in the last 24 hours.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export function SecurityModulePanel({ moduleHref }: ModuleContextProps) {
  const { data, isError, isLoading, refetch } = useSecurity()

  const statusByHref = {
    '/dashboard/security-center': isLoading ? 'loading' as const : isError ? 'down' as const : 'ok' as const,
    '/dashboard/admin-users': isLoading ? 'loading' as const : isError ? 'down' as const : 'ok' as const,
    '/dashboard/roles': isLoading ? 'loading' as const : isError ? 'down' as const : 'ok' as const,
    '/dashboard/permissions': 'warn' as const,
    '/dashboard/audit-logs': isLoading ? 'loading' as const : isError ? 'down' as const : 'ok' as const,
  }

  let body: React.ReactNode
  if (isError) {
    body = <ApiOfflineBanner message="Security API offline — run pnpm dev:api on port 4000." />
  } else if (moduleHref === '/dashboard/admin-users') {
    body = <AdminUsersView data={data} isLoading={isLoading} />
  } else if (moduleHref === '/dashboard/roles') {
    body = <RolesView data={data} isLoading={isLoading} />
  } else if (moduleHref === '/dashboard/permissions') {
    body = <PermissionsView />
  } else if (moduleHref === '/dashboard/audit-logs') {
    body = <AuditLogsView data={data} isLoading={isLoading} refetch={() => void refetch()} />
  } else {
    body = <SecurityCenterView data={data} isLoading={isLoading} />
  }

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SecuritySubNav activeHref={moduleHref} statusByHref={statusByHref} />
      {body}
    </div>
  )
}
