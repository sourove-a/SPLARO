'use client'

import { useEffect, useState } from 'react'
import { KeyRound, Plus, RefreshCw, ScrollText, Search, Send, Shield, ShieldCheck, Trash2, UserX, X } from 'lucide-react'
import { toastApiSaved, toastFail, toastOk } from '@/lib/admin/feedback'
import {
  confirmAdminInvited,
  confirmRolePermissionsSaved,
  confirmSessionRevoked,
  confirmStaffActiveUpdated,
  confirmStaffRemoved,
  confirmStaffRoleUpdated,
  confirmTelegramLinkTokenGenerated,
  confirmTelegramReset,
} from '@/lib/admin/security-save'
import type { ModuleContextProps } from '@/lib/modules/module-data'
import {
  useAdminSession,
  useInviteAdmin,
  useRemoveStaff,
  useResetStaffTelegram,
  useRevokeSecuritySession,
  useRolePermissions,
  useSaveRolePermissions,
  useSecurity,
  useSecuritySessions,
  useStaffTelegramLinkToken,
  useUpdateStaffRole,
} from '@/lib/api/hooks'
import type { PermissionRow } from '@/lib/api/security'
import {
  fetchDatabaseConnection,
  saveDatabaseConnection,
  testDatabaseConnection,
  type DatabaseConnectionInfo,
} from '@/lib/api/security'
import { ASSIGNABLE_STAFF_ROLES, CEO_EMAIL } from '@/lib/auth/role-label'
import { SecuritySubNav } from '@/components/security/SecuritySubNav'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'
import { AdminButton } from '@/components/ui/AdminButton'
import { AdminStatusBadge } from '@/components/ui/AdminStatusBadge'
import { cn } from '@/lib/utils/cn'

// ─── Design tokens ──────────────────────────────────────────────────────────
const GOLD = 'var(--admin-accent, var(--admin-c-712eff))'
const GOLD_LIGHT = 'rgba(113, 46, 255, 0.10)'
const GOLD_BORDER = 'rgba(113, 46, 255, 0.28)'

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
  const tone =
    accent === 'success' ? 'success' : accent === 'warning' ? 'warning' : accent === 'gold' ? 'gold' : undefined
  return (
    <div className={cn('admin-kpi-card', tone && `admin-kpi-card--${tone}`)}>
      <p className="admin-kpi-card__label">{label}</p>
      <div className="admin-kpi-card__row">
        <p className="admin-kpi-card__value">{value}</p>
      </div>
    </div>
  )
}

function KpiRow({ children }: { children: React.ReactNode }) {
  return <div className="admin-kpi-grid admin-kpi-grid--catalog">{children}</div>
}

function PanelHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="admin-catalog-hero__title-row mb-5">
      <div className="admin-catalog-icon-ring admin-catalog-icon-ring--lg">
        <Icon strokeWidth={2} />
      </div>
      <h3 className="admin-catalog-hero__title !text-base">{title}</h3>
    </div>
  )
}

function GlassSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="admin-catalog-toolbar__search max-w-[380px] flex-1">
      <Search className="admin-catalog-toolbar__search-icon" aria-hidden />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search…'}
        className="admin-catalog-input"
      />
    </div>
  )
}

function StatusBadge({ value, ok }: { value: string; ok?: boolean }) {
  return <AdminStatusBadge label={value} tone={ok ? 'success' : 'warning'} />
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

const INVITE_ROLES = ASSIGNABLE_STAFF_ROLES.filter((r) => r.value !== 'SUPER_ADMIN')

function InviteAdminModal({ open, onClose, actorRole }: { open: boolean; onClose: () => void; actorRole?: string | undefined }) {
  const invite = useInviteAdmin()
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState<string>('STAFF')

  useEffect(() => {
    if (!open) return
    setEmail('')
    setFirstName('')
    setLastName('')
    setRole('STAFF')
  }, [open])

  if (!open) return null

  const roleOptions =
    actorRole === 'SUPER_ADMIN' || actorRole === 'ADMIN'
      ? INVITE_ROLES
      : INVITE_ROLES.filter((r) => r.value === 'STAFF' || r.value === 'MANAGER')

  const submit = async () => {
    if (!email.trim() || !firstName.trim()) {
      toastFail('Email and first name are required.')
      return
    }
    const ok = await confirmAdminInvited(
      { email: email.trim(), role },
      () =>
        invite.mutateAsync({
          email: email.trim(),
          firstName: firstName.trim(),
          ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
          role,
        }),
    )
    if (ok) onClose()
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" aria-label="Close" onClick={onClose} />
      <div className="relative z-[1] w-full max-w-md rounded-[18px] border border-white/20 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[var(--admin-c-1c1c24)]">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--admin-text-muted)]">Security</p>
            <h3 className="mt-1 text-lg font-black text-[var(--admin-text-primary)]">Invite admin</h3>
            <p className="mt-1 text-xs font-semibold text-[var(--admin-text-muted)]">
              Sends a premium email — they verify and set their own password.
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
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="admin-input w-full" placeholder="admin@splaro.co" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--admin-text-muted)]">Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="admin-input w-full">
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <GoldBtn onClick={onClose}>Cancel</GoldBtn>
          <GoldBtn onClick={submit} disabled={invite.isPending}>
            {invite.isPending ? 'Sending…' : 'Send invite'}
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
  const linkTelegram = useStaffTelegramLinkToken()
  const resetTelegram = useResetStaffTelegram()
  const { data: currentUser } = useAdminSession()
  const rows = (data?.adminUsers ?? []).filter((r) =>
    r.name.toLowerCase().includes(query.toLowerCase()) || r.email.includes(query),
  )

  const handleRoleChange = async (userId: string, email: string, roleValue: string) => {
    if (email.toLowerCase() === CEO_EMAIL) {
      toastFail('CEO role cannot be changed')
      return
    }
    await confirmStaffRoleUpdated(userId, roleValue, () =>
      updateRole.mutateAsync({ userId, role: roleValue }),
    )
  }

  const handleToggleActive = async (userId: string, email: string, isActive: boolean) => {
    if (email.toLowerCase() === CEO_EMAIL) {
      toastFail('CEO account cannot be deactivated')
      return
    }
    await confirmStaffActiveUpdated(userId, isActive, () =>
      updateRole.mutateAsync({ userId, isActive }),
    )
  }

  const handleRemove = async (userId: string, email: string, name: string) => {
    if (email.toLowerCase() === CEO_EMAIL) {
      toastFail('CEO account cannot be removed')
      return
    }
    if (!window.confirm(`Remove admin access for ${name}? They will no longer be able to log in.`)) return
    await confirmStaffRemoved(userId, email, () => removeStaff.mutateAsync(userId))
  }

  const handleLinkMyTelegram = async () => {
    await confirmTelegramLinkTokenGenerated(() => linkTelegram.mutateAsync(undefined), 'tg-staff-link')
  }

  const handleResetTelegram = async (userId: string, name: string) => {
    if (!window.confirm(`Reset Telegram for ${name}? They must link again before login codes work.`)) return
    await confirmTelegramReset(userId, name, () => resetTelegram.mutateAsync(userId))
  }

  const currentRow = currentUser
    ? rows.find((r) => r.id === currentUser.id || r.email.toLowerCase() === currentUser.email.toLowerCase())
    : null
  const showLinkBanner = currentRow && !currentRow.telegramLinked

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
        <PanelHeader icon={Shield} title="Admin Users" />
        <KpiRow>
          <KpiCard label="Total admins"  value={isLoading ? '…' : kpis?.totalAdmins ?? 0} />
          <KpiCard label="Active"        value={isLoading ? '…' : kpis?.activeAdmins ?? 0} accent="success" />
          <KpiCard label="2FA enabled"   value={isLoading ? '…' : kpis?.twoFaEnabled ?? 0} accent="gold" />
          <KpiCard label="Sessions"      value={isLoading ? '…' : kpis?.activeSessions ?? 0} accent="warning" />
        </KpiRow>
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

      {showLinkBanner ? (
        <div
          className="settings-card admin-panel-glass-subtle"
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            border: '1px solid rgba(245,158,11,0.35)',
            background: 'rgba(245,158,11,0.08)',
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--admin-text-primary)' }}>
              Link your Telegram to receive login codes
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)' }}>
              Without a linked Telegram, login codes cannot be delivered to you.
            </p>
          </div>
          <GoldBtn onClick={handleLinkMyTelegram} disabled={linkTelegram.isPending}>
            <Send style={{ width: 14, height: 14 }} />
            Link my Telegram
          </GoldBtn>
        </div>
      ) : null}

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
                {['Name', 'Email', 'Role', 'Status', '2FA', 'Telegram', 'Last login', 'Actions'].map((h) => (
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
                    <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 800, color: row.twoFA ? 'var(--admin-success-ink)' : 'var(--admin-text-muted)' }}>{row.twoFA ? 'Yes' : 'No'}</td>
                    <td style={{ padding: '12px 20px' }}>
                      {row.telegramLinked ? (
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--admin-success-ink)' }}>
                          {row.telegramUsername ? `@${row.telegramUsername}` : 'Linked'}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--admin-warning-ink)' }}>Not linked</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 12, color: 'var(--admin-text-muted)' }}>{row.lastLogin}</td>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {currentUser?.id === row.id && !row.telegramLinked ? (
                          <button
                            type="button"
                            title="Link my Telegram"
                            disabled={linkTelegram.isPending}
                            onClick={handleLinkMyTelegram}
                            className="admin-commerce-icon-btn"
                          >
                            <Send size={13} />
                          </button>
                        ) : null}
                        {!isCeo && canManageStaff(actorRole) ? (
                          <>
                            {isSuperAdmin(actorRole) && row.telegramLinked ? (
                              <button
                                type="button"
                                title="Reset Telegram binding"
                                disabled={resetTelegram.isPending}
                                onClick={() => handleResetTelegram(row.id, row.name)}
                                className="admin-commerce-icon-btn"
                              >
                                <RefreshCw size={13} />
                              </button>
                            ) : null}
                            <button
                              type="button"
                              title={row.status === 'active' ? 'Deactivate' : 'Reactivate'}
                              disabled={updateRole.isPending || removeStaff.isPending}
                              onClick={() => handleToggleActive(row.id, row.email, row.status !== 'active')}
                              className="admin-commerce-icon-btn"
                            >
                              <UserX size={13} />
                            </button>
                            {isSuperAdmin(actorRole) ? (
                              <button
                                type="button"
                                title="Remove admin access"
                                disabled={updateRole.isPending || removeStaff.isPending}
                                onClick={() => handleRemove(row.id, row.email, row.name)}
                                className="admin-commerce-icon-btn"
                              >
                                <Trash2 size={13} />
                              </button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
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
  const roleCards = data?.roles ?? []

  return (
    <div className="settings-section-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
        <PanelHeader icon={ShieldCheck} title="Roles" />
        <KpiRow>
          <KpiCard label="Roles"          value={isLoading ? '…' : roleCards.length} />
          <KpiCard label="Assigned users" value={isLoading ? '…' : kpis?.totalAdmins ?? 0} accent="success" />
          <KpiCard label="Custom roles"   value="0" accent="gold" />
          <KpiCard label="Locked"         value="0" accent="warning" />
        </KpiRow>
      </div>

      {roleCards.length === 0 && !isLoading ? (
        <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-text-muted)', margin: 0 }}>
            No roles returned from API yet — refresh after API is connected.
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
      )}
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
    if (fromApi?.length) setPermRows(fromApi)
  }, [data, role, roleApiKey])

  const hasApiPermissions = Boolean(data?.roles.find((r) => r.role === roleApiKey)?.permissions?.length)

  const togglePerm = (module: string, key: keyof Omit<PermissionRow, 'module'>) => {
    setPermRows((prev) => prev.map((row) => (row.module === module ? { ...row, [key]: !row[key] } : row)))
  }

  const handleSave = async () => {
    await confirmRolePermissionsSaved(
      roleApiKey,
      permRows,
      role,
      () => savePermissions.mutateAsync({ role: roleApiKey, permissions: permRows }),
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
        <KpiRow>
          <KpiCard label="Modules"    value={permRows.length} />
          <KpiCard label="Role"       value={role} accent="gold" />
          <KpiCard label="Granted"    value={permRows.filter((r) => r.view).length} accent="success" />
          <KpiCard label="Restricted" value={permRows.filter((r) => !r.view).length} accent="warning" />
        </KpiRow>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {ROLE_OPTIONS.map((item) => (
          <button key={item} type="button" onClick={() => setRole(item)} className={role === item ? 'admin-role-tab admin-role-tab--active' : 'admin-role-tab'}>
            {item}
          </button>
        ))}
      </div>

      {!hasApiPermissions && !isLoading ? (
        <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-text-muted)', margin: 0 }}>
            Permissions for {role} not loaded from API — cannot edit until data is available.
          </p>
        </div>
      ) : (
      <>
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
        <GoldBtn onClick={handleSave} disabled={savePermissions.isPending || isLoading || !isSuperAdmin(actorRole) || !hasApiPermissions}>
          {savePermissions.isPending ? 'Saving…' : isSuperAdmin(actorRole) ? 'Save permissions' : 'Super Admin required to save'}
        </GoldBtn>
      </div>
      </>
      )}
    </div>
  )
}

function AuditLogsView({
  data,
  isLoading,
  refetch,
}: {
  data: ReturnType<typeof useSecurity>['data']
  isLoading: boolean
  refetch: () => Promise<unknown>
}) {
  const kpis = data?.kpis
  const [query, setQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const logs = (data?.auditLogs ?? []).filter((r) => r.action.toLowerCase().includes(query.toLowerCase()))

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await refetch()
      toastOk('Audit logs refreshed')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not refresh audit logs')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="settings-section-enter flex flex-col gap-5">
      <div className="settings-card admin-panel-glass p-6">
        <PanelHeader icon={ScrollText} title="Audit Logs" />
        <KpiRow>
          <KpiCard label="Events" value={isLoading ? '…' : logs.length} />
          <KpiCard label="Failed logins 24h" value={isLoading ? '…' : kpis?.failedLogins24h ?? 0} accent="warning" />
          <KpiCard label="Threat level" value={kpis?.threatLevel ?? '—'} accent={kpis?.threatLevel === 'low' ? 'success' : 'warning'} />
          <KpiCard label="Sessions" value={isLoading ? '…' : kpis?.activeSessions ?? 0} accent="gold" />
        </KpiRow>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <GlassSearch value={query} onChange={setQuery} placeholder="Search audit logs…" />
        <AdminButton
          size="sm"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          aria-busy={refreshing || undefined}
          aria-label="Refresh audit logs"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} aria-hidden />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </AdminButton>
      </div>

      <div className="flex flex-col gap-2">
        {logs.map((row) => (
          <div key={row.id} className="settings-card admin-panel-glass-subtle admin-module-row px-4 py-3">
            <div className="admin-module-icon-ring h-8 w-8 rounded-[9px]">
              <ScrollText className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[13px] font-extrabold text-[var(--admin-text-primary)]">{row.action}</p>
              <p className="m-0 text-[11px] font-semibold text-[var(--admin-text-muted)]">
                {row.actor} · {row.target} · {row.time}
              </p>
            </div>
            <StatusBadge value={row.severity} ok={row.severity !== 'danger'} />
          </div>
        ))}
        {logs.length === 0 && !isLoading && (
          <div className="settings-card admin-panel-glass-subtle px-6 py-8 text-center text-[13px] font-semibold text-[var(--admin-text-muted)]">
            No audit events yet. Actions in admin will appear here.
          </div>
        )}
      </div>
    </div>
  )
}

function DatabaseConnectionCard() {
  const [info, setInfo] = useState<DatabaseConnectionInfo | null>(null)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState({ host: '', port: '', database: '', user: '', password: '' })
  const [busy, setBusy] = useState<'test' | 'save' | null>(null)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    fetchDatabaseConnection()
      .then((data) => {
        setInfo(data)
        setForm((p) => ({ ...p, host: data.host, port: data.port, database: data.database, user: data.user }))
      })
      .catch((e: Error) => setLoadError(e.message))
  }, [])

  const payload = () => ({
    host: form.host.trim(),
    port: form.port.trim(),
    database: form.database.trim(),
    user: form.user.trim(),
    password: form.password,
  })

  const runTest = async () => {
    setBusy('test')
    setResult(null)
    try {
      setResult(await testDatabaseConnection(payload()))
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'Test failed' })
    } finally {
      setBusy(null)
    }
  }

  const runSave = async () => {
    setBusy('save')
    setResult(null)
    try {
      const res = await saveDatabaseConnection(payload())
      setResult(res)
      if (!res.ok) {
        toastFail(res.message || 'Database credentials save failed')
        return
      }
      const fresh = await fetchDatabaseConnection()
      if (!fresh.savedInDatabase) {
        toastFail('Save did not persist to database — check API connection.')
        return
      }
      toastApiSaved('Database credentials')
      setInfo(fresh)
      setForm((p) => ({ ...p, password: '' }))
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Save failed'
      setResult({ ok: false, message })
      toastFail(message)
    } finally {
      setBusy(null)
    }
  }

  const fieldStyle = { display: 'flex', flexDirection: 'column' as const, gap: 4 }
  const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--admin-text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }

  return (
    <div className="settings-card admin-panel-glass" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="admin-module-icon-ring" style={{ width: 36, height: 36 }}>
            <KeyRound style={{ width: 16, height: 16 }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--admin-text-primary)', margin: 0 }}>Database connection</p>
        </div>
        {info && (
          <span style={{ fontSize: 12, fontWeight: 900, color: info.connected ? 'var(--admin-success-ink)' : 'var(--admin-danger-strong)' }}>
            {info.connected ? '● Connected' : '● Disconnected'}
          </span>
        )}
      </div>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text-muted)', margin: '0 0 16px' }}>
        Changed the PostgreSQL password in hPanel? Test verifies the connection; Save stores the URL encrypted in the
        database. Restart the API after save so all connections use the new credentials.
      </p>
      {info?.requiresRestart ? (
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--admin-warning-ink)', margin: '0 0 12px' }}>
          Saved credentials differ from the running API — restart required to apply.
        </p>
      ) : null}

      {loadError ? (
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-danger-strong)', margin: 0 }}>{loadError}</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 12 }}>
            <div style={fieldStyle}>
              <span style={labelStyle}>Host</span>
              <input className="admin-input" value={form.host} onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))} placeholder="localhost" />
            </div>
            <div style={fieldStyle}>
              <span style={labelStyle}>Port</span>
              <input className="admin-input" value={form.port} onChange={(e) => setForm((p) => ({ ...p, port: e.target.value }))} placeholder="5432" />
            </div>
            <div style={fieldStyle}>
              <span style={labelStyle}>Database</span>
              <input className="admin-input" value={form.database} onChange={(e) => setForm((p) => ({ ...p, database: e.target.value }))} placeholder="splaro_db" />
            </div>
            <div style={fieldStyle}>
              <span style={labelStyle}>User</span>
              <input className="admin-input" value={form.user} onChange={(e) => setForm((p) => ({ ...p, user: e.target.value }))} placeholder="postgres" />
            </div>
          </div>
          <div style={{ ...fieldStyle, marginBottom: 16 }}>
            <span style={labelStyle}>New password {info?.passwordSet ? '(leave blank to keep current)' : ''}</span>
            <input className="admin-input" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="••••••••" autoComplete="new-password" />
          </div>

          {result && (
            <div className="settings-card admin-panel-glass-subtle" style={{ padding: '10px 14px', marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: result.ok ? 'var(--admin-success-ink)' : 'var(--admin-danger-strong)', margin: 0 }}>{result.message}</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <GoldBtn disabled={busy !== null} onClick={() => void runTest()}>
              {busy === 'test' ? 'Testing…' : 'Test connection'}
            </GoldBtn>
            <GoldBtn disabled={busy !== null} onClick={() => void runSave()}>
              {busy === 'save' ? 'Saving…' : 'Test & save'}
            </GoldBtn>
          </div>
        </>
      )}
    </div>
  )
}

function SecurityCenterView({
  data,
  isLoading,
  isFetching,
  actorRole,
  onRefreshOverview,
}: {
  data: ReturnType<typeof useSecurity>['data']
  isLoading: boolean
  isFetching: boolean
  actorRole?: string | undefined
  onRefreshOverview: () => Promise<unknown>
}) {
  const sessionsQuery = useSecuritySessions()
  const revokeSession = useRevokeSecuritySession()
  const [overviewRefreshing, setOverviewRefreshing] = useState(false)
  const [sessionsRefreshing, setSessionsRefreshing] = useState(false)
  const kpis = data?.kpis
  const threatLabel = kpis?.threatLevel === 'low' ? 'Low' : kpis?.threatLevel === 'medium' ? 'Medium' : kpis?.threatLevel ? 'High' : '—'
  const twoFaCoverage = kpis?.totalAdmins
    ? `${Math.round(((kpis.twoFaEnabled ?? 0) / kpis.totalAdmins) * 100)}%`
    : '0%'
  const posture = data?.posture ?? []
  const threats = data?.threats ?? []

  const handleOverviewRefresh = async () => {
    if (overviewRefreshing || isFetching) return
    setOverviewRefreshing(true)
    try {
      await onRefreshOverview()
      if (isSuperAdmin(actorRole)) {
        await sessionsQuery.refetch({ throwOnError: false })
      }
      toastOk('Security overview refreshed')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not refresh security overview')
    } finally {
      setOverviewRefreshing(false)
    }
  }

  const handleSessionsRefresh = async () => {
    if (sessionsRefreshing || sessionsQuery.isFetching) return
    setSessionsRefreshing(true)
    try {
      const result = await sessionsQuery.refetch({ throwOnError: false })
      if (result.error) {
        toastFail(result.error instanceof Error ? result.error.message : 'Could not refresh sessions')
        return
      }
      toastOk('Device sessions refreshed')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not refresh sessions')
    } finally {
      setSessionsRefreshing(false)
    }
  }

  const overviewBusy = overviewRefreshing || (isFetching && !isLoading)
  const sessionsBusy = sessionsRefreshing || sessionsQuery.isFetching

  return (
    <div className="settings-section-enter flex flex-col gap-5">
      {/* KPI strip — page title already comes from DcPageHead */}
      <section className="admin-catalog-hero admin-panel-hero !mb-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="admin-catalog-hero__title-row">
            <div className="admin-catalog-icon-ring admin-catalog-icon-ring--lg">
              <Shield strokeWidth={2} />
            </div>
            <div>
              <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--admin-text-muted)]">
                Live posture
              </p>
              <h2 className="admin-catalog-hero__title !text-lg">Security Center</h2>
              <p className="m-0 text-sm font-semibold text-[var(--admin-text-secondary)]">
                Threat monitoring · 2FA · sessions · lockouts
              </p>
            </div>
          </div>
          <AdminButton
            size="sm"
            variant="secondary"
            onClick={() => void handleOverviewRefresh()}
            disabled={overviewBusy}
            aria-busy={overviewBusy || undefined}
            aria-label="Refresh security overview"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', overviewBusy && 'animate-spin')} aria-hidden />
            {overviewBusy ? 'Refreshing…' : 'Refresh'}
          </AdminButton>
        </div>
        <div className="admin-kpi-grid admin-kpi-grid--catalog">
          <div className={cn('admin-kpi-card', kpis?.threatLevel === 'low' ? 'admin-kpi-card--success' : 'admin-kpi-card--warning')}>
            <p className="admin-kpi-card__label">Threat score</p>
            <div className="admin-kpi-card__row"><p className="admin-kpi-card__value">{isLoading ? '…' : threatLabel}</p></div>
          </div>
          <div className={cn('admin-kpi-card', twoFaCoverage === '0%' ? 'admin-kpi-card--warning' : 'admin-kpi-card--success')}>
            <p className="admin-kpi-card__label">2FA coverage</p>
            <div className="admin-kpi-card__row"><p className="admin-kpi-card__value">{isLoading ? '…' : twoFaCoverage}</p></div>
          </div>
          <div className="admin-kpi-card">
            <p className="admin-kpi-card__label">Sessions</p>
            <div className="admin-kpi-card__row"><p className="admin-kpi-card__value">{isLoading ? '…' : kpis?.activeSessions ?? 0}</p></div>
          </div>
          <div className="admin-kpi-card admin-kpi-card--gold">
            <p className="admin-kpi-card__label">Blocked 24h</p>
            <div className="admin-kpi-card__row"><p className="admin-kpi-card__value">{isLoading ? '…' : kpis?.failedLogins24h ?? 0}</p></div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="settings-card admin-panel-glass flex min-h-[220px] flex-col p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="admin-module-icon-ring h-9 w-9">
              <Shield className="h-4 w-4" />
            </div>
            <p className="m-0 text-sm font-extrabold text-[var(--admin-text-primary)]">Security posture</p>
          </div>
          {isLoading && posture.length === 0 ? (
            <p className="m-0 text-[13px] font-semibold text-[var(--admin-text-muted)]">Loading posture…</p>
          ) : posture.length === 0 ? (
            <p className="m-0 text-[13px] font-semibold text-[var(--admin-text-muted)]">No posture checks returned from API.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {posture.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-muted,transparent)] px-3.5 py-2.5"
                >
                  <span className="text-xs font-semibold text-[var(--admin-text-secondary)]">{item.label}</span>
                  <span
                    className={cn(
                      'shrink-0 text-[13px] font-black tabular-nums',
                      item.ok ? 'text-[var(--admin-success-ink)]' : 'text-[var(--admin-warning-ink)]',
                    )}
                  >
                    {item.value}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="settings-card admin-panel-glass flex min-h-[220px] flex-col p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="admin-module-icon-ring h-9 w-9">
              <KeyRound className="h-4 w-4" />
            </div>
            <p className="m-0 text-sm font-extrabold text-[var(--admin-text-primary)]">Recent threats</p>
          </div>
          {threats.length > 0 ? (
            <div className="flex flex-col gap-2">
              {threats.map((row) => (
                <div
                  key={row.id}
                  className="rounded-xl border border-[var(--admin-border)] px-3.5 py-2.5"
                >
                  <p className="mb-0.5 mt-0 text-[13px] font-extrabold text-[var(--admin-text-primary)]">{row.action}</p>
                  <p className="m-0 text-[11px] font-semibold text-[var(--admin-text-muted)]">{row.time}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[rgba(22,163,74,0.35)] bg-[rgba(22,163,74,0.06)] px-4 py-8 text-center">
              <ShieldCheck className="mb-2 h-6 w-6 text-[var(--admin-success-ink)]" aria-hidden />
              <p className="m-0 text-[13px] font-bold text-[var(--admin-success-ink)]">No threats detected in the last 24 hours</p>
              <p className="mt-1 mb-0 text-[11px] font-semibold text-[var(--admin-text-muted)]">
                Failed logins and blocked attempts will appear here.
              </p>
            </div>
          )}
        </section>
      </div>

      {isSuperAdmin(actorRole) ? (
        <section className="settings-card admin-panel-glass p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="m-0 text-sm font-extrabold text-[var(--admin-text-primary)]">Active device sessions</p>
              <p className="mt-0.5 mb-0 text-[11px] font-semibold text-[var(--admin-text-muted)]">
                Revoke ends that device&apos;s admin session immediately.
              </p>
            </div>
            <AdminButton
              size="sm"
              onClick={() => void handleSessionsRefresh()}
              disabled={sessionsBusy}
              aria-busy={sessionsBusy || undefined}
              aria-label="Refresh device sessions"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', sessionsBusy && 'animate-spin')} aria-hidden />
              {sessionsBusy ? 'Refreshing…' : 'Refresh'}
            </AdminButton>
          </div>
          {sessionsQuery.isError ? (
            <p className="m-0 text-xs font-semibold text-[var(--admin-text-muted)]">
              Could not load sessions — Super Admin access required, or API offline.
            </p>
          ) : (sessionsQuery.data?.length ?? 0) === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--admin-border)] px-4 py-6 text-center">
              <p className="m-0 text-[13px] font-semibold text-[var(--admin-text-muted)]">
                No tracked device sessions yet.
              </p>
              <p className="mt-1 mb-0 text-[11px] font-semibold text-[var(--admin-text-muted)]">
                Admin panel uses signed tokens (12h). Sessions appear after staff sign in.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {sessionsQuery.data!.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--admin-border)] px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="mb-0.5 mt-0 text-[13px] font-extrabold text-[var(--admin-text-primary)]">
                      {session.user.firstName} {session.user.lastName}
                    </p>
                    <p className="m-0 text-[11px] font-semibold text-[var(--admin-text-muted)]">
                      {session.user.email} · {session.ipAddress ?? 'unknown IP'}
                    </p>
                  </div>
                  <AdminButton
                    size="sm"
                    variant="danger"
                    disabled={revokeSession.isPending}
                    aria-label={`Revoke session for ${session.user.email}`}
                    onClick={() =>
                      void confirmSessionRevoked(session.id, () => revokeSession.mutateAsync(session.id))
                    }
                  >
                    Revoke
                  </AdminButton>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {isSuperAdmin(actorRole) ? <DatabaseConnectionCard /> : null}
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export function SecurityModulePanel({ moduleHref }: ModuleContextProps) {
  const { data, isError, isLoading, isFetching, refetch } = useSecurity()
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
    body = (
      <ApiOfflineBanner
        message="Security API offline — run pnpm dev:api on port 4000."
        onRetry={() => void refetch()}
      />
    )
  } else if (moduleHref === '/dashboard/admin-users') {
    body = <AdminUsersView data={data} isLoading={isLoading} actorRole={actorRole} />
  } else if (moduleHref === '/dashboard/roles') {
    body = <RolesView data={data} isLoading={isLoading} />
  } else if (moduleHref === '/dashboard/permissions') {
    body = <PermissionsView actorRole={actorRole} />
  } else if (moduleHref === '/dashboard/audit-logs') {
    body = <AuditLogsView data={data} isLoading={isLoading} refetch={() => refetch()} />
  } else {
    body = (
      <SecurityCenterView
        data={data}
        isLoading={isLoading}
        isFetching={isFetching}
        actorRole={actorRole}
        onRefreshOverview={() => refetch()}
      />
    )
  }

  return (
    <div className="settings-section-enter flex flex-col gap-4">
      <SecuritySubNav activeHref={moduleHref} statusByHref={statusByHref} />
      {body}
    </div>
  )
}
