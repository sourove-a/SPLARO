'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { KeyRound, Plus, RefreshCw, ScrollText, Search, Shield, ShieldCheck, Trash2, UserX, X } from 'lucide-react'
import { toastApiSaved, toastFail } from '@/lib/admin/feedback'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import {
  useAdminSession,
  useInviteAdmin,
  useRemoveStaff,
  useRevokeSecuritySession,
  useRolePermissions,
  useSaveRolePermissions,
  useSecurity,
  useSecuritySessions,
  useUpdateStaffRole,
} from '@/lib/api/hooks'
import type { PermissionRow } from '@/lib/api/security'
import { ASSIGNABLE_STAFF_ROLES, CEO_EMAIL } from '@/lib/auth/role-label'
import { SecuritySubNav } from '@/components/security/SecuritySubNav'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'

// ─── Design tokens ──────────────────────────────────────────────────────────
const GOLD = '#c8a97e'
const GOLD_LIGHT = 'rgba(200,169,126,0.10)'
const GOLD_BORDER = 'rgba(200,169,126,0.32)'

// ─── Types ───────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = ['Super Admin', 'Admin', 'Manager', 'Editor'] as const

const ROLE_UI_TO_API: Record<(typeof ROLE_OPTIONS)[number], string> = {
  'Super Admin': 'SUPER_ADMIN',
  Admin: 'ADMIN',
  Manager: 'MANAGER',
  Editor: 'STAFF',
}

const DEFAULT_PERMISSIONS: PermissionRow[] = [
  { module: 'Orders',      view: true,  create: true,  edit: true,  delete: false },
  { module: 'Products',    view: true,  create: true,  edit: true,  delete: true  },
  { module: 'Finance',     view: true,  create: false, edit: false, delete: false },
  { module: 'Admin Users', view: true,  create: false, edit: false, delete: false },
  { module: 'Settings',    view: true,  create: true,  edit: true,  delete: false },
]

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
    <div className="admin-glass-search-wrap" style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
      <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--admin-text-muted)', pointerEvents: 'none' }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search…'}
        className="admin-glass-search-input"
        style={{ width: '100%', paddingLeft: 36, paddingRight: 14, paddingTop: 9, paddingBottom: 9 }}
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

function GoldBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="admin-catalog-action">
      {children}
    </button>
  )
}

function assignableRolesForActor(actorRole?: string) {
  if (actorRole === 'SUPER_ADMIN') return ASSIGNABLE_STAFF_ROLES
  return ASSIGNABLE_STAFF_ROLES.filter((r) => r.value !== 'SUPER_ADMIN')
}

function canManageStaff(actorRole?: string) {
  return actorRole === 'SUPER_ADMIN' || actorRole === 'ADMIN'
}

function isSuperAdmin(actorRole?: string) {
  return actorRole === 'SUPER_ADMIN'
}

function InviteAdminModal({ open, onClose, actorRole }: { open: boolean; onClose: () => void; actorRole?: string | undefined }) {
  const invite = useInviteAdmin()
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState<string>('STAFF')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (!open) return
    setEmail('')
    setFirstName('')
    setLastName('')
    setRole('STAFF')
    setPassword('')
  }, [open])

  if (!open) return null

  const submit = () => {
    if (!email.trim() || !firstName.trim() || password.length < 8) {
      toastFail('Email, first name, and password (min 8 chars) are required.')
      return
    }
    invite.mutate(
      {
        email: email.trim(),
        firstName: firstName.trim(),
        ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
        role,
        password,
      },
      {
        onSuccess: (res) => {
          toastApiSaved(`Admin ${res.email} invited`)
          onClose()
        },
        onError: (err) => toastFail(err instanceof Error ? err.message : 'Could not invite admin.'),
      },
    )
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" aria-label="Close" onClick={onClose} />
      <div className="relative z-[1] w-full max-w-md rounded-[18px] border border-white/20 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#1c1c24]">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--admin-text-muted)]">Security</p>
            <h3 className="mt-1 text-lg font-black text-[var(--admin-text-primary)]">Invite admin</h3>
            <p className="mt-1 text-xs font-semibold text-[var(--admin-text-muted)]">
              Creates a user in the database and assigns store access.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--admin-text-muted)] hover:bg-black/5">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--admin-text-muted)]">First name</span>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="admin-input w-full" placeholder="Rahim" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--admin-text-muted)]">Last name</span>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="admin-input w-full" placeholder="Optional" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--admin-text-muted)]">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="admin-input w-full" placeholder="admin@splaro.com.bd" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--admin-text-muted)]">Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="admin-input w-full">
              {assignableRolesForActor(actorRole).map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--admin-text-muted)]">Temporary password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="admin-input w-full" placeholder="Min 8 characters" />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <GoldBtn onClick={onClose}>Cancel</GoldBtn>
          <GoldBtn onClick={submit} disabled={invite.isPending}>
            {invite.isPending ? 'Creating…' : 'Create admin'}
          </GoldBtn>
        </div>
      </div>
    </div>
  )
}

// ─── Views ────────────────────────────────────────────────────────────────────
function AdminUsersView({
  data,
  isLoading,
  actorRole,
}: {
  data: ReturnType<typeof useSecurity>['data']
  isLoading: boolean
  actorRole?: string | undefined
}) {
  const kpis = data?.kpis
  const [query, setQuery] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const updateRole = useUpdateStaffRole()
  const removeStaff = useRemoveStaff()
  const rows = (data?.adminUsers ?? []).filter((r) =>
    r.name.toLowerCase().includes(query.toLowerCase()) || r.email.includes(query),
  )

  const handleRoleChange = (userId: string, email: string, roleValue: string) => {
    if (email.toLowerCase() === CEO_EMAIL) {
      toast.error('CEO role cannot be changed')
      return
    }
    updateRole.mutate(
      { userId, role: roleValue },
      {
        onSuccess: () => toastApiSaved('Role updated'),
        onError: (e) => toastFail(e.message),
      },
    )
  }

  const handleToggleActive = (userId: string, email: string, isActive: boolean) => {
    if (email.toLowerCase() === CEO_EMAIL) {
      toastFail('CEO account cannot be deactivated')
      return
    }
    updateRole.mutate(
      { userId, isActive },
      {
        onSuccess: () => toastApiSaved(isActive ? 'Admin reactivated' : 'Admin deactivated'),
        onError: (e) => toastFail(e.message),
      },
    )
  }

  const handleRemove = (userId: string, email: string, name: string) => {
    if (email.toLowerCase() === CEO_EMAIL) {
      toastFail('CEO account cannot be removed')
      return
    }
    if (!window.confirm(`Remove admin access for ${name}? They will no longer be able to log in.`)) return
    removeStaff.mutate(userId, {
      onSuccess: () => toastApiSaved(`Removed ${email}`),
      onError: (e) => toastFail(e.message),
    })
  }

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
        {isSuperAdmin(actorRole) && (
          <GoldBtn onClick={() => setInviteOpen(true)}>
            <Plus style={{ width: 14, height: 14 }} />
            Invite admin
          </GoldBtn>
        )}
      </div>

      <InviteAdminModal open={inviteOpen} onClose={() => setInviteOpen(false)} actorRole={actorRole} />

      <div className="settings-card admin-panel-glass" style={{ padding: 0, overflow: 'hidden' }}>
        {rows.length === 0 && !isLoading ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-text-muted)', margin: '0 0 8px' }}>No admin users in database yet.</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)', margin: 0 }}>Run <code style={{ fontSize: 11 }}>pnpm db:seed</code> or assign staff roles via API. CEO: {CEO_EMAIL}</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-table-row-border)' }}>
                {['Name', 'Email', 'Role', 'Status', '2FA', 'Last login', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isCeo = row.email.toLowerCase() === CEO_EMAIL
                const roleValue = ASSIGNABLE_STAFF_ROLES.find((r) => r.label === row.role)?.value
                  ?? (row.role === 'CEO' ? 'SUPER_ADMIN' : row.role.toUpperCase().replace(/ /g, '_'))
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--admin-table-row-border)' }}>
                    <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 700, color: 'var(--admin-text-primary)' }}>{row.name}</td>
                    <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--admin-text-muted)' }}>{row.email}</td>
                    <td style={{ padding: '12px 20px' }}>
                      {isCeo ? (
                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--admin-text-secondary)' }}>CEO</span>
                      ) : (
                        <select
                          value={roleValue}
                          disabled={updateRole.isPending || !isSuperAdmin(actorRole)}
                          onChange={(e) => handleRoleChange(row.id, row.email, e.target.value)}
                          className="admin-role-select"
                        >
                          {assignableRolesForActor(actorRole).map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td style={{ padding: '12px 20px' }}><StatusBadge value={row.status} ok={row.status === 'active'} /></td>
                    <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 800, color: row.twoFA ? '#15803D' : 'var(--admin-text-muted)' }}>{row.twoFA ? 'Yes' : 'No'}</td>
                    <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--admin-text-muted)' }}>{row.lastLogin}</td>
                    <td style={{ padding: '12px 20px' }}>
                      {!isCeo && canManageStaff(actorRole) && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            title={row.status === 'active' ? 'Deactivate' : 'Reactivate'}
                            disabled={updateRole.isPending || removeStaff.isPending}
                            onClick={() => handleToggleActive(row.id, row.email, row.status !== 'active')}
                            className="admin-commerce-icon-btn"
                          >
                            <UserX size={13} />
                          </button>
                          {isSuperAdmin(actorRole) && (
                            <button
                              type="button"
                              title="Remove admin access"
                              disabled={updateRole.isPending || removeStaff.isPending}
                              onClick={() => handleRemove(row.id, row.email, row.name)}
                              className="admin-commerce-icon-btn"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function RolesView({ data, isLoading }: { data: ReturnType<typeof useSecurity>['data']; isLoading: boolean }) {
  const kpis = data?.kpis
  const roleCards = (data?.roles.length ?? 0) > 0
    ? data!.roles
    : [
        { id: 'SUPER_ADMIN', name: 'Super Admin', users: 0, permissions: 'Full platform access', status: 'active' },
        { id: 'ADMIN', name: 'Admin', users: 0, permissions: 'Catalog, orders, customers', status: 'active' },
        { id: 'MANAGER', name: 'Manager', users: 0, permissions: 'Operations & fulfillment', status: 'active' },
        { id: 'STAFF', name: 'Editor', users: 0, permissions: 'Content & product edits', status: 'active' },
      ]

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
        {roleCards.map((r) => (
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

function PermissionsView({ actorRole }: { actorRole?: string | undefined }) {
  const { data, isLoading, isError } = useRolePermissions()
  const savePermissions = useSaveRolePermissions()
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]>('Manager')
  const [permRows, setPermRows] = useState<PermissionRow[]>(DEFAULT_PERMISSIONS)

  const roleApiKey = ROLE_UI_TO_API[role]

  useEffect(() => {
    const fromApi = data?.roles.find((r) => r.role === roleApiKey)?.permissions
    setPermRows(fromApi?.length ? fromApi : DEFAULT_PERMISSIONS)
  }, [data, role, roleApiKey])

  const togglePerm = (module: string, key: keyof Omit<PermissionRow, 'module'>) => {
    setPermRows((prev) => prev.map((row) => (row.module === module ? { ...row, [key]: !row[key] } : row)))
  }

  const handleSave = () => {
    savePermissions.mutate(
      { role: roleApiKey, permissions: permRows },
      {
        onSuccess: () => toastApiSaved(`${role} permissions saved to server`),
        onError: (err) => toastFail(err instanceof Error ? err.message : 'Could not save permissions.'),
      },
    )
  }

  if (isError) {
    return <ApiOfflineBanner message="Permissions API offline — run pnpm dev:api on port 4000." />
  }

  if (!canManageStaff(actorRole)) {
    return (
      <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-text-muted)', margin: 0 }}>
          Only Admin or Super Admin can view permission settings.
        </p>
      </div>
    )
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
          <button key={item} type="button" onClick={() => setRole(item)} className={role === item ? 'admin-role-tab admin-role-tab--active' : 'admin-role-tab'}>
            {item}
          </button>
        ))}
      </div>

      <div className="settings-card admin-panel-glass" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--admin-table-row-border)' }}>
              {['Module', 'View', 'Create', 'Edit', 'Delete'].map((h) => (
                <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permRows.map((row) => (
              <tr key={row.module} style={{ borderBottom: '1px solid var(--admin-table-row-border)' }}>
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
        <GoldBtn onClick={handleSave} disabled={savePermissions.isPending || isLoading || !isSuperAdmin(actorRole)}>
          {savePermissions.isPending ? 'Saving…' : isSuperAdmin(actorRole) ? 'Save permissions' : 'Super Admin required to save'}
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

function SecurityCenterView({
  data,
  isLoading,
  actorRole,
}: {
  data: ReturnType<typeof useSecurity>['data']
  isLoading: boolean
  actorRole?: string | undefined
}) {
  const sessionsQuery = useSecuritySessions()
  const revokeSession = useRevokeSecuritySession()
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

      {isSuperAdmin(actorRole) && (
        <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--admin-text-primary)', margin: 0 }}>Active device sessions</p>
            <GoldBtn onClick={() => void sessionsQuery.refetch()}>Refresh</GoldBtn>
          </div>
          {sessionsQuery.isError ? (
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)', margin: 0 }}>
              Could not load sessions — Super Admin access required.
            </p>
          ) : (sessionsQuery.data?.length ?? 0) === 0 ? (
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)', margin: 0 }}>
              No tracked device sessions yet. Admin panel uses signed tokens (12h).
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sessionsQuery.data!.map((session) => (
                <div key={session.id} className="settings-card admin-panel-glass-subtle" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--admin-text-primary)', margin: '0 0 2px' }}>
                      {session.user.firstName} {session.user.lastName}
                    </p>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--admin-text-muted)', margin: 0 }}>
                      {session.user.email} · {session.ipAddress ?? 'unknown IP'}
                    </p>
                  </div>
                  <GoldBtn
                    disabled={revokeSession.isPending}
                    onClick={() =>
                      revokeSession.mutate(session.id, {
                        onSuccess: () => toastApiSaved('Session revoked'),
                        onError: (e) => toastFail(e.message),
                      })
                    }
                  >
                    Revoke
                  </GoldBtn>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export function SecurityModulePanel({ moduleHref }: ModuleContextProps) {
  const { data, isError, isLoading, refetch } = useSecurity()
  const permissionsQuery = useRolePermissions()
  const { data: sessionUser } = useAdminSession()
  const actorRole = sessionUser?.role?.toUpperCase()

  const statusByHref = {
    '/dashboard/security-center': isLoading ? 'loading' as const : isError ? 'down' as const : 'ok' as const,
    '/dashboard/admin-users': isLoading ? 'loading' as const : isError ? 'down' as const : 'ok' as const,
    '/dashboard/roles': isLoading ? 'loading' as const : isError ? 'down' as const : 'ok' as const,
    '/dashboard/permissions': permissionsQuery.isLoading
      ? 'loading' as const
      : permissionsQuery.isError
        ? 'down' as const
        : 'ok' as const,
    '/dashboard/audit-logs': isLoading ? 'loading' as const : isError ? 'down' as const : 'ok' as const,
  }

  let body: React.ReactNode
  if (isError) {
    body = <ApiOfflineBanner message="Security API offline — run pnpm dev:api on port 4000." />
  } else if (moduleHref === '/dashboard/admin-users') {
    body = <AdminUsersView data={data} isLoading={isLoading} actorRole={actorRole} />
  } else if (moduleHref === '/dashboard/roles') {
    body = <RolesView data={data} isLoading={isLoading} />
  } else if (moduleHref === '/dashboard/permissions') {
    body = <PermissionsView actorRole={actorRole} />
  } else if (moduleHref === '/dashboard/audit-logs') {
    body = <AuditLogsView data={data} isLoading={isLoading} refetch={() => void refetch()} />
  } else {
    body = <SecurityCenterView data={data} isLoading={isLoading} actorRole={actorRole} />
  }

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SecuritySubNav activeHref={moduleHref} statusByHref={statusByHref} />
      {body}
    </div>
  )
}
