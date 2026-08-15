'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcModal } from '@/components/dc/DcModal'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { dcPageStatus } from '@/components/dc/page-status'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import { toastFail, toastOk, toastWarn } from '@/lib/admin/feedback'
import { downloadCsv } from '@/lib/admin/admin-actions'
import {
  confirmAdminInvited,
  confirmStaffActiveUpdated,
  confirmStaffRemoved,
  confirmStaffRoleUpdated,
  confirmTelegramLinkToken,
  confirmTelegramReset,
  type TelegramLinkTokenResult,
} from '@/lib/admin/security-save'
import {
  useAdminSession,
  useInviteAdmin,
  useRemoveStaff,
  useResetStaffTelegram,
  useSecurity,
  useStaffTelegramLinkToken,
  useUpdateStaffRole,
} from '@/lib/api/hooks'
import { fetchMyTelegramStatus } from '@/lib/api/security'
import { ASSIGNABLE_STAFF_ROLES, CEO_EMAIL } from '@/lib/auth/role-label'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const capsLabel = {
  font: `600 11px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
}

type StaffRow = NonNullable<ReturnType<typeof useSecurity>['data']>['adminUsers'][number]
type ConfirmAction =
  | { kind: 'remove'; row: StaffRow }
  | { kind: 'deactivate'; row: StaffRow }
  | { kind: 'reset-telegram'; row: StaffRow }

const INVITE_ROLES = ASSIGNABLE_STAFF_ROLES.filter((role) => role.value !== 'SUPER_ADMIN')

function assignableRolesForActor(actorRole?: string) {
  if (actorRole === 'SUPER_ADMIN') return ASSIGNABLE_STAFF_ROLES
  return ASSIGNABLE_STAFF_ROLES.filter((role) => role.value !== 'SUPER_ADMIN')
}

function roleValue(row: StaffRow): string {
  return (
    ASSIGNABLE_STAFF_ROLES.find((role) => role.label === row.role)?.value ??
    (row.role === 'CEO' ? 'SUPER_ADMIN' : row.role.toUpperCase().replace(/ /g, '_'))
  )
}

function roleScope(role: string): string {
  const value = role.toUpperCase().replace(/ /g, '_')
  if (value === 'CEO' || value === 'SUPER_ADMIN') return 'Full platform · Partner Hub owner'
  if (value === 'ADMIN') return 'Ops, settings & partner ledger'
  if (value === 'MANAGER') return 'Orders, catalog & finance entry'
  if (value === 'EDITOR' || value === 'STAFF') return 'Catalog content'
  if (value === 'VIEWER') return 'Read only'
  return 'Assigned modules'
}

function actorCanManage(actorRole?: string) {
  return actorRole === 'SUPER_ADMIN' || actorRole === 'ADMIN'
}

export function DcAdminUsers() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="staff" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcAdminUsersBody />
    </DcScreenProvider>
  )
}

function DcAdminUsersBody() {
  const security = useSecurity()
  const session = useAdminSession()
  const updateRole = useUpdateStaffRole()
  const invite = useInviteAdmin()
  const removeStaff = useRemoveStaff()
  const linkTelegram = useStaffTelegramLinkToken()
  const resetTelegram = useResetStaffTelegram()
  const { api } = useAdminConnection(25_000)

  const [query, setQuery] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [linkModal, setLinkModal] = useState<TelegramLinkTokenResult | null>(null)
  const [confirming, setConfirming] = useState<ConfirmAction | null>(null)
  const [inviteForm, setInviteForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'STAFF',
  })

  const rows = useMemo(() => security.data?.adminUsers ?? [], [security.data])
  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) =>
      `${row.name} ${row.email} ${row.role} ${row.status}`.toLowerCase().includes(needle),
    )
  }, [query, rows])

  const currentRow = session.data
    ? rows.find(
        (row) =>
          row.id === session.data?.id ||
          row.email.toLowerCase() === session.data?.email.toLowerCase(),
      )
    : null
  const ownerCount = rows.filter((row) => {
    const role = roleValue(row)
    return row.email.toLowerCase() === CEO_EMAIL || role === 'SUPER_ADMIN'
  }).length
  const activeCount = rows.filter((row) => row.status === 'active').length
  const linked2Fa = rows.filter((row) => row.telegramLinked).length
  const actorRole = session.data?.role
  const pageStatus = dcPageStatus([security, session], api.pulse)
  const mutating =
    updateRole.isPending ||
    invite.isPending ||
    removeStaff.isPending ||
    linkTelegram.isPending ||
    resetTelegram.isPending

  const refresh = () => {
    void security.refetch()
    void session.refetch()
  }

  const handleRoleChange = async (row: StaffRow, nextRole: string) => {
    if (row.email.toLowerCase() === CEO_EMAIL) {
      toastFail('Owner role cannot be changed')
      return
    }
    await confirmStaffRoleUpdated(row.id, nextRole, () =>
      updateRole.mutateAsync({ userId: row.id, role: nextRole }),
    )
  }

  const handleReactivate = async (row: StaffRow) => {
    if (row.email.toLowerCase() === CEO_EMAIL) {
      toastFail('Owner account cannot be deactivated')
      return
    }
    await confirmStaffActiveUpdated(row.id, true, () =>
      updateRole.mutateAsync({ userId: row.id, isActive: true }),
    )
  }

  const handleLinkMyTelegram = async () => {
    try {
      const saved = await linkTelegram.mutateAsync(undefined)
      if (!confirmTelegramLinkToken(saved)) return
      setLinkModal(saved as TelegramLinkTokenResult)
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Could not create link code.')
    }
  }

  const submitInvite = async () => {
    const email = inviteForm.email.trim()
    const firstName = inviteForm.firstName.trim()
    if (!email || !firstName) {
      toastFail('Email and first name are required.')
      return
    }
    const ok = await confirmAdminInvited(
      { email, role: inviteForm.role },
      () =>
        invite.mutateAsync({
          email,
          firstName,
          ...(inviteForm.lastName.trim() ? { lastName: inviteForm.lastName.trim() } : {}),
          role: inviteForm.role,
        }),
    )
    if (!ok) return
    setInviteOpen(false)
    setInviteForm({ firstName: '', lastName: '', email: '', role: 'STAFF' })
  }

  const runConfirmedAction = async () => {
    if (!confirming) return
    const { row } = confirming
    let ok = false
    if (confirming.kind === 'remove') {
      ok = await confirmStaffRemoved(row.id, row.email, () => removeStaff.mutateAsync(row.id))
    } else if (confirming.kind === 'deactivate') {
      ok = await confirmStaffActiveUpdated(row.id, false, () =>
        updateRole.mutateAsync({ userId: row.id, isActive: false }),
      )
    } else {
      ok = await confirmTelegramReset(row.id, row.name, () =>
        resetTelegram.mutateAsync(row.id),
      )
    }
    if (ok) setConfirming(null)
  }

  const skeleton: DcBlock[] = [
    { t: 'banner' } as DcBlock,
    { t: 'kpis' } as DcBlock,
    { t: 'table' } as DcBlock,
  ]

  const exportCsv = () => {
    if (rows.length === 0) {
      toastWarn('No staff members to export')
      return
    }
    const headers = [
      'Name',
      'Email',
      'Role',
      'Status',
      'Telegram 2FA Linked',
      'Scope',
    ]
    const csvRows = [
      headers,
      ...rows.map((row) => [
        row.name,
        row.email,
        row.role,
        row.status,
        row.telegramLinked ? 'Yes' : 'No',
        roleScope(row.role),
      ]),
    ]
    downloadCsv(`splaro-admin-staff-${new Date().toISOString().slice(0, 10)}.csv`, csvRows)
    toastOk(`Exported ${rows.length} admin user${rows.length === 1 ? '' : 's'}.`)
  }

  return (
    <>
      <DcPageHead
        crumbGroup="Security"
        title="Admin Users"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          security.isFetching
            ? 'syncing…'
            : `${rows.length} user${rows.length === 1 ? '' : 's'} · ${activeCount} active`
        }
        syncing={security.isFetching}
        onSync={refresh}
        actions={[
          ...(actorRole === 'SUPER_ADMIN'
            ? [
                {
                  label: 'Invite admin',
                  icon: 'icon-plus',
                  variant: 'primary' as const,
                  onClick: () => setInviteOpen(true),
                },
              ]
            : []),
          {
            label: 'Export CSV',
            icon: 'icon-download',
            onClick: exportCsv,
          },
        ]}
      />

      {security.isLoading || session.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : security.error ? (
        <DcErrorState
          error={`GET /admin/security → ${security.error instanceof Error ? security.error.message : '500 Internal Server Error'}`}
          hint="Existing admin access is unchanged. This screen did not load staff data."
          onRetry={refresh}
        />
      ) : rows.length === 0 ? (
        <DcEmptyState
          icon="icon-users"
          title="No admin users returned"
          body="GET /admin/security answered with an empty staff list. You are signed in, so at least one account must exist — this usually means the request resolved a different store. Retry, and check the store scope if it persists."
        />
      ) : (
        <>
          <InfoBanner
            linked={Boolean(currentRow?.telegramLinked)}
            action={
              currentRow && !currentRow.telegramLinked
                ? {
                    label: linkTelegram.isPending ? 'Creating code…' : 'Link my Telegram',
                    onClick: handleLinkMyTelegram,
                  }
                : undefined
            }
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: 12,
            }}
          >
            <Kpi
              label="Admin users"
              value={String(rows.length)}
              sub={`${activeCount} active account${activeCount === 1 ? '' : 's'}`}
            />
            <Kpi
              label="Owners"
              value={String(ownerCount)}
              sub="Owner and Super Admin access"
            />
            <Kpi
              label="Telegram 2FA linked"
              value={`${linked2Fa} of ${rows.length}`}
              sub={`${Math.max(0, rows.length - linked2Fa)} still need linking`}
              color={linked2Fa < rows.length ? 'var(--warn)' : 'var(--ok)'}
            />
            <Kpi
              label="Active sessions"
              value={String(security.data?.kpis.activeSessions ?? 0)}
              sub="verified server sessions"
            />
          </div>

          <AdminUsersTable
            rows={filteredRows}
            total={rows.length}
            query={query}
            onQueryChange={setQuery}
            actorRole={actorRole}
            currentUserId={session.data?.id}
            busy={mutating}
            onRoleChange={handleRoleChange}
            onLinkTelegram={handleLinkMyTelegram}
            onResetTelegram={(row) => setConfirming({ kind: 'reset-telegram', row })}
            onToggleActive={(row) => {
              if (row.status === 'active') {
                setConfirming({ kind: 'deactivate', row })
              } else {
                void handleReactivate(row)
              }
            }}
            onRemove={(row) => setConfirming({ kind: 'remove', row })}
          />
        </>
      )}

      <InviteModal
        open={inviteOpen}
        busy={invite.isPending}
        actorRole={actorRole}
        form={inviteForm}
        onChange={setInviteForm}
        onClose={() => setInviteOpen(false)}
        onConfirm={() => void submitInvite()}
      />

      <ConfirmStaffModal
        action={confirming}
        busy={mutating}
        onClose={() => setConfirming(null)}
        onConfirm={() => void runConfirmedAction()}
      />

      <TelegramLinkModal
        open={linkModal !== null}
        token={linkModal}
        busy={linkTelegram.isPending}
        onClose={() => setLinkModal(null)}
        onRefresh={() => {
          refresh()
          void fetchMyTelegramStatus()
            .then((status) => {
              if (status.telegramLinked) {
                setLinkModal(null)
                toastOk('Telegram linked — login codes will arrive in your personal chat.')
              }
            })
            .catch(() => undefined)
        }}
      />
    </>
  )
}

function InfoBanner({
  linked,
  action,
}: {
  linked: boolean
  action?: { label: string; onClick: () => void } | undefined
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '11px 13px',
        border: `1px solid ${linked ? 'var(--ok-bd)' : 'var(--warn-bd)'}`,
        borderRadius: 11,
        background: linked ? 'var(--ok-soft)' : 'var(--warn-soft)',
      }}
    >
      <DcIcon name={linked ? 'icon-check-circle' : 'icon-alert-triangle'} size={15} color={linked ? 'var(--ok)' : 'var(--warn)'} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          font: `400 12px/1.5 ${FONT}`,
          color: 'var(--ink-2)',
        }}
      >
        {linked ? (
          <>
            <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>Telegram 2FA linked.</strong>
            {' '}Login codes go to your personal chat — not a shared group.
          </>
        ) : (
          <>
            <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>Telegram not linked.</strong>
            {' '}Generate a one-time code, send <code style={{ font: `600 11px/1 ${MONO}` }}>/login CODE</code> to the SPLARO bot, then refresh this page.
          </>
        )}
      </span>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          style={{
            height: 31,
            padding: '0 11px',
            flex: 'none',
            borderRadius: 8,
            border: '1px solid var(--info-bd)',
            background: 'var(--surface)',
            color: 'var(--info)',
            cursor: 'pointer',
            font: `600 11.5px/1 ${FONT}`,
          }}
        >
          {action.label}
        </button>
      ) : null}
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
    <div style={{ ...card, padding: '14px 15px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={capsLabel}>{label}</span>
      <span
        style={{
          font: `700 25px/1 ${FONT}`,
          letterSpacing: '-.025em',
          color: color ?? 'var(--ink)',
        }}
      >
        {value}
      </span>
      <span style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
    </div>
  )
}

function AdminUsersTable({
  rows,
  total,
  query,
  onQueryChange,
  actorRole,
  currentUserId,
  busy,
  onRoleChange,
  onLinkTelegram,
  onResetTelegram,
  onToggleActive,
  onRemove,
}: {
  rows: StaffRow[]
  total: number
  query: string
  onQueryChange: (value: string) => void
  actorRole?: string | undefined
  currentUserId?: string | undefined
  busy: boolean
  onRoleChange: (row: StaffRow, role: string) => Promise<void>
  onLinkTelegram: () => Promise<void>
  onResetTelegram: (row: StaffRow) => void
  onToggleActive: (row: StaffRow) => void
  onRemove: (row: StaffRow) => void
}) {
  return (
    <section style={{ ...card, overflow: 'hidden' }}>
      <div
        style={{
          minHeight: 50,
          padding: '9px 13px 9px 15px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: '1px solid var(--line)',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ flex: 1, minWidth: 150, font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
          Admin users
          <span style={{ marginLeft: 8, font: `500 11px/1 ${MONO}`, color: 'var(--ink-3)' }}>
            {total}
          </span>
        </span>
        <label
          style={{
            width: 'min(260px, 100%)',
            height: 32,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 10px',
            border: '1px solid var(--line)',
            borderRadius: 8,
            background: 'var(--surface-2)',
            color: 'var(--ink-3)',
          }}
        >
          <DcIcon name="icon-search" size={13} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search users…"
            type="search"
            name="dc-users-filter"
            className="dc-nav-filter"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            style={{
              width: '100%',
              border: 0,
              outline: 0,
              background: 'transparent',
              color: 'var(--ink)',
              font: `400 11.5px/1 ${FONT}`,
            }}
          />
        </label>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {['User', 'Role', 'Scope', 'Last login', 'Telegram 2FA', 'Status', ''].map(
                (label, index) => (
                  <th
                    key={`${label}-${index}`}
                    style={{
                      padding: '9px 13px',
                      borderBottom: '1px solid var(--line)',
                      textAlign: index === 6 ? 'right' : 'left',
                      ...capsLabel,
                      fontSize: 10.5,
                    }}
                  >
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '38px 16px', textAlign: 'center' }}>
                  <span style={{ font: `400 12px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
                    {total === 0 ? 'No admin users returned by server.' : 'No users match this search.'}
                  </span>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isCeo = row.email.toLowerCase() === CEO_EMAIL
                const value = roleValue(row)
                const canManage = !isCeo && actorCanManage(actorRole)
                return (
                  <tr key={row.id}>
                    <td style={cellStyle}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            width: 29,
                            height: 29,
                            flex: 'none',
                            display: 'grid',
                            placeItems: 'center',
                            border: '1px solid var(--violet-bd)',
                            borderRadius: 8,
                            background: 'var(--violet-soft)',
                            color: 'var(--violet)',
                            font: `700 10px/1 ${FONT}`,
                          }}
                        >
                          {initials(row.name)}
                        </span>
                        <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ font: `600 12px/1.2 ${FONT}`, color: 'var(--ink)' }}>
                            {row.name}
                          </span>
                          <span style={{ font: `400 10.5px/1.2 ${FONT}`, color: 'var(--ink-3)' }}>
                            {row.email}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td style={cellStyle}>
                      {isCeo ? (
                        <span style={{ font: `600 11.5px/1 ${FONT}`, color: 'var(--ink)' }}>Owner</span>
                      ) : (
                        <select
                          value={value}
                          disabled={busy || actorRole !== 'SUPER_ADMIN'}
                          onChange={(event) => void onRoleChange(row, event.target.value)}
                          style={{
                            height: 30,
                            maxWidth: 126,
                            border: '1px solid var(--line)',
                            borderRadius: 8,
                            background: 'var(--surface-2)',
                            color: 'var(--ink)',
                            padding: '0 8px',
                            font: `600 11px/1 ${FONT}`,
                            opacity: actorRole === 'SUPER_ADMIN' ? 1 : 0.75,
                          }}
                        >
                          {assignableRolesForActor(actorRole).map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td style={cellStyle}>
                      <span style={{ font: `400 11.5px/1.3 ${FONT}`, color: 'var(--ink-2)' }}>
                        {roleScope(value)}
                      </span>
                    </td>
                    <td style={cellStyle}>
                      <span style={{ font: `400 11px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                        {row.lastLogin}
                      </span>
                    </td>
                    <td style={cellStyle}>
                      {row.telegramLinked ? (
                        <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
                          <MiniBadge label="Linked" tone="ok" />
                          <span style={{ font: `500 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                            {row.telegramUsername ? `@${row.telegramUsername}` : 'Personal chat'}
                          </span>
                        </span>
                      ) : (
                        <MiniBadge label="Not linked" tone="warn" />
                      )}
                    </td>
                    <td style={cellStyle}>
                      <MiniBadge
                        label={row.status}
                        tone={row.status === 'active' ? 'ok' : 'mute'}
                      />
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'right' }}>
                      <span style={{ display: 'inline-flex', justifyContent: 'flex-end', gap: 5 }}>
                        {currentUserId === row.id && !row.telegramLinked ? (
                          <IconButton
                            icon="icon-send"
                            title="Link my Telegram"
                            disabled={busy}
                            onClick={() => void onLinkTelegram()}
                          />
                        ) : null}
                        {canManage ? (
                          <>
                            {actorRole === 'SUPER_ADMIN' && row.telegramLinked ? (
                              <IconButton
                                icon="icon-refresh-cw"
                                title="Reset Telegram"
                                disabled={busy}
                                onClick={() => onResetTelegram(row)}
                              />
                            ) : null}
                            <IconButton
                              icon={row.status === 'active' ? 'icon-user-x' : 'icon-user-check'}
                              title={row.status === 'active' ? 'Deactivate' : 'Reactivate'}
                              disabled={busy}
                              onClick={() => onToggleActive(row)}
                            />
                            {actorRole === 'SUPER_ADMIN' ? (
                              <IconButton
                                icon="icon-trash-2"
                                title="Remove admin access"
                                danger
                                disabled={busy}
                                onClick={() => onRemove(row)}
                              />
                            ) : null}
                          </>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const cellStyle = {
  padding: '10px 13px',
  borderBottom: '1px solid var(--line)',
  verticalAlign: 'middle',
} as const

function MiniBadge({ label, tone }: { label: string; tone: DcTone }) {
  const colors = toneStyle(tone)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 22,
        padding: '0 7px',
        border: `1px solid ${colors.bd}`,
        borderRadius: 6,
        background: colors.bg,
        color: colors.fg,
        font: `600 10px/1 ${FONT}`,
        textTransform: 'capitalize',
      }}
    >
      <span style={{ width: 4, height: 4, borderRadius: 99, background: 'currentColor' }} />
      {label}
    </span>
  )
}

function IconButton({
  icon,
  title,
  danger,
  disabled,
  onClick,
}: {
  icon: string
  title: string
  danger?: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 29,
        height: 29,
        display: 'grid',
        placeItems: 'center',
        border: `1px solid ${danger ? 'var(--bad-bd)' : 'var(--line)'}`,
        borderRadius: 8,
        background: danger ? 'var(--bad-soft)' : 'var(--surface-2)',
        color: danger ? 'var(--bad)' : 'var(--ink-2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <DcIcon name={icon} size={12} />
    </button>
  )
}

function InviteModal({
  open,
  busy,
  actorRole,
  form,
  onChange,
  onClose,
  onConfirm,
}: {
  open: boolean
  busy: boolean
  actorRole?: string | undefined
  form: { firstName: string; lastName: string; email: string; role: string }
  onChange: (form: { firstName: string; lastName: string; email: string; role: string }) => void
  onClose: () => void
  onConfirm: () => void
}) {
  const roles =
    actorRole === 'SUPER_ADMIN' || actorRole === 'ADMIN'
      ? INVITE_ROLES
      : INVITE_ROLES.filter((role) => role.value === 'STAFF' || role.value === 'MANAGER')

  return (
    <DcModal
      open={open}
      title="Invite admin"
      subtitle="Creates server account, then sends verification email when mail delivery is available."
      confirmLabel="Send invite"
      busy={busy}
      onClose={onClose}
      onConfirm={onConfirm}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
        <ModalField
          label="First name"
          value={form.firstName}
          onChange={(firstName) => onChange({ ...form, firstName })}
          placeholder="Rahim"
        />
        <ModalField
          label="Last name"
          value={form.lastName}
          onChange={(lastName) => onChange({ ...form, lastName })}
          placeholder="Optional"
        />
      </div>
      <ModalField
        label="Email"
        value={form.email}
        onChange={(email) => onChange({ ...form, email })}
        placeholder="admin@splaro.co"
        type="email"
      />
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={capsLabel}>Role</span>
        <select
          value={form.role}
          onChange={(event) => onChange({ ...form, role: event.target.value })}
          style={fieldStyle}
        >
          {roles.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
      </label>
    </DcModal>
  )
}

function ModalField({
  label,
  value,
  placeholder,
  type = 'text',
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  type?: 'text' | 'email'
  onChange: (value: string) => void
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={capsLabel}>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={fieldStyle}
      />
    </label>
  )
}

const fieldStyle = {
  width: '100%',
  height: 36,
  padding: '0 10px',
  border: '1px solid var(--line)',
  borderRadius: 9,
  outline: 0,
  background: 'var(--surface-2)',
  color: 'var(--ink)',
  font: `400 12px/1 ${FONT}`,
} as const

function ConfirmStaffModal({
  action,
  busy,
  onClose,
  onConfirm,
}: {
  action: ConfirmAction | null
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const copy =
    action?.kind === 'remove'
      ? {
          title: `Remove ${action.row.name}?`,
          subtitle: 'Admin access will be removed. This user will no longer be able to sign in.',
          label: 'Remove access',
          danger: true,
        }
      : action?.kind === 'deactivate'
        ? {
            title: `Deactivate ${action.row.name}?`,
            subtitle: 'Sign-in will be blocked until this account is reactivated.',
            label: 'Deactivate',
            danger: true,
          }
        : {
            title: `Reset Telegram for ${action?.row.name ?? 'this user'}?`,
            subtitle: 'Existing Telegram binding will be removed. User must link again for login codes.',
            label: 'Reset Telegram',
            danger: false,
          }

  return (
    <DcModal
      open={action !== null}
      title={copy.title}
      subtitle={copy.subtitle}
      confirmLabel={copy.label}
      danger={copy.danger}
      busy={busy}
      onClose={onClose}
      onConfirm={onConfirm}
    >
      <span style={{ font: `400 12px/1.55 ${FONT}`, color: 'var(--ink-2)' }}>
        Server response and persisted state will be verified before success appears.
      </span>
    </DcModal>
  )
}

function TelegramLinkModal({
  open,
  token,
  busy,
  onClose,
  onRefresh,
}: {
  open: boolean
  token: TelegramLinkTokenResult | null
  busy: boolean
  onClose: () => void
  onRefresh: () => void
}) {
  const command = token ? `/login ${token.code}` : ''

  const copyCommand = async () => {
    if (!command) return
    try {
      await navigator.clipboard.writeText(command)
      toastOk('Copied /login command to clipboard', 'tg-link-copy')
    } catch {
      toastFail('Could not copy — select and copy manually', 'tg-link-copy-fail')
    }
  }

  return (
    <DcModal
      open={open}
      title="Link Telegram for login codes"
      subtitle="One-time code — expires in 5 minutes. Send it from your personal Telegram account."
      confirmLabel="I've linked — refresh"
      busy={busy}
      onClose={onClose}
      onConfirm={onRefresh}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <ol style={{ margin: 0, paddingLeft: 18, font: `500 12.5px/1.55 ${FONT}`, color: 'var(--ink-2)' }}>
          <li>Open the SPLARO bot in Telegram on your phone.</li>
          <li>
            Send this exact command:
            <div
              style={{
                marginTop: 8,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
                font: `700 14px/1.3 ${MONO}`,
                color: 'var(--ink)',
                wordBreak: 'break-all',
              }}
            >
              {command || '—'}
            </div>
          </li>
          <li>Wait for the bot confirmation message, then tap refresh below.</li>
        </ol>
        <button
          type="button"
          disabled={!command}
          onClick={() => void copyCommand()}
          style={{
            justifySelf: 'start',
            height: 34,
            padding: '0 12px',
            borderRadius: 9,
            border: '1px solid var(--line)',
            background: 'var(--surface)',
            color: 'var(--ink)',
            cursor: command ? 'pointer' : 'not-allowed',
            font: `600 12px/1 ${FONT}`,
          }}
        >
          Copy /login command
        </button>
        {token?.email ? (
          <span style={{ font: `500 11.5px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
            Linking account: {token.email}
          </span>
        ) : null}
      </div>
    </DcModal>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'SP'
  return `${parts[0]?.[0] ?? ''}${parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''}`.toUpperCase()
}
