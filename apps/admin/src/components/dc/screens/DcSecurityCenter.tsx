'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { DcIcon } from '@/components/dc/DcIcon'
import { DcModal } from '@/components/dc/DcModal'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { dcPageStatus } from '@/components/dc/page-status'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import { confirmSessionRevoked } from '@/lib/admin/security-save'
import {
  useAdminSession,
  useRevokeSecuritySession,
  useSecurity,
  useSecuritySessions,
} from '@/lib/api/hooks'
import type { SecuritySessionRow } from '@/lib/api/security'
import type { SecurityData } from '@/lib/api/platform'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const capsLabel = {
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.085em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
}

const cellStyle = {
  padding: '11px 13px',
  borderBottom: '1px solid var(--line)',
  verticalAlign: 'middle' as const,
}

type AuditRow = SecurityData['auditLogs'][number]
type PostureRow = SecurityData['posture'][number]

function isSuperAdmin(role?: string) {
  return role?.toUpperCase() === 'SUPER_ADMIN'
}

function threatTone(level?: string): DcTone {
  if (level === 'low') return 'ok'
  if (level === 'medium') return 'warn'
  return level ? 'bad' : 'mute'
}

function threatLabel(level?: string) {
  if (!level) return '—'
  return level.charAt(0).toUpperCase() + level.slice(1)
}

function severityTone(row: AuditRow): DcTone {
  const value = `${row.severity} ${row.action}`.toLowerCase()
  if (value.includes('danger') || value.includes('fail') || value.includes('block')) return 'bad'
  if (value.includes('warn')) return 'warn'
  return 'ok'
}

function sessionDevice(row: SecuritySessionRow) {
  return row.deviceName || [row.browser, row.os].filter(Boolean).join(' · ') || 'Unknown device'
}

function stableTime(value: string) {
  if (!value.includes('T')) return value
  return `${value.replace('T', ' ').slice(0, 16)} UTC`
}

export function DcSecurityCenter() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="security" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcSecurityCenterBody />
    </DcScreenProvider>
  )
}

function DcSecurityCenterBody() {
  const security = useSecurity()
  const adminSession = useAdminSession()
  const sessions = useSecuritySessions(isSuperAdmin(adminSession.data?.role))
  const revokeSession = useRevokeSecuritySession()
  const { api } = useAdminConnection(25_000)
  const [confirming, setConfirming] = useState<SecuritySessionRow | null>(null)

  const actorRole = adminSession.data?.role
  const canViewSessions = isSuperAdmin(actorRole)
  const statusSources = canViewSessions
    ? [security, adminSession, sessions]
    : [security, adminSession]
  const pageStatus = dcPageStatus(statusSources, api.pulse)
  const data = security.data
  const kpis = data?.kpis
  const admins = Math.max(kpis?.totalAdmins ?? 0, data?.adminUsers.length ?? 0)
  const coverage = admins ? Math.round(((kpis?.twoFaEnabled ?? 0) / admins) * 100) : 0
  const auditRows = data?.auditLogs ?? []
  const posture = data?.posture ?? []
  const threats = data?.threats ?? []
  const liveSessions = sessions.data ?? []
  const syncing = security.isFetching || adminSession.isFetching || (canViewSessions && sessions.isFetching)

  const refresh = () => {
    void security.refetch()
    void adminSession.refetch()
    if (canViewSessions) void sessions.refetch()
  }

  const runRevoke = async () => {
    if (!confirming) return
    const ok = await confirmSessionRevoked(confirming.id, () =>
      revokeSession.mutateAsync(confirming.id),
    )
    if (ok) setConfirming(null)
  }

  const skeleton: DcBlock[] = [
    { t: 'kpis' } as DcBlock,
    { t: 'table', w: 'main' } as DcBlock,
    { t: 'toggles', w: 'side' } as DcBlock,
  ]

  return (
    <>
      <DcPageHead
        crumbGroup="Security"
        title="Security Center"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          syncing
            ? 'syncing audit…'
            : `${auditRows.length} audit event${auditRows.length === 1 ? '' : 's'} · ${kpis?.activeSessions ?? 0} active sessions`
        }
        syncing={syncing}
        onSync={refresh}
      />

      {security.isLoading || adminSession.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : security.error ? (
        <DcErrorState
          error={`GET /admin/security → ${security.error instanceof Error ? security.error.message : '500 Internal Server Error'}`}
          hint="Security data and audit log were not changed. Check API connection, then retry."
          onRetry={refresh}
        />
      ) : (
        <>
          <SecurityKpis
            logins={kpis?.logins24h ?? 0}
            failed={kpis?.failedLogins24h ?? 0}
            sessions={kpis?.activeSessions ?? 0}
            twoFaEnabled={kpis?.twoFaEnabled ?? 0}
            adminCount={admins}
            coverage={coverage}
            level={kpis?.threatLevel}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 16,
              minWidth: 0,
            }}
          >
            <AuditLog rows={auditRows} />
            <div
              style={{
                flex: '1 1 290px',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <PolicyCard rows={posture} />
              <ThreatCard rows={threats} level={kpis?.threatLevel} />
            </div>
          </div>

          {canViewSessions ? (
            <SessionsCard
              rows={liveSessions}
              loading={sessions.isLoading}
              error={sessions.error}
              busy={revokeSession.isPending}
              onRetry={() => void sessions.refetch()}
              onRevoke={setConfirming}
            />
          ) : null}
        </>
      )}

      <DcModal
        open={Boolean(confirming)}
        title="Revoke this session?"
        subtitle={
          confirming
            ? `${confirming.user.email ?? 'This admin'} will be signed out on ${sessionDevice(confirming)}.`
            : undefined
        }
        confirmLabel="Revoke session"
        danger
        busy={revokeSession.isPending}
        onClose={() => setConfirming(null)}
        onConfirm={() => void runRevoke()}
      >
        <div
          style={{
            padding: '11px 12px',
            border: '1px solid var(--bad-bd)',
            borderRadius: 10,
            background: 'var(--bad-soft)',
            color: 'var(--ink-2)',
            font: `400 12px/1.5 ${FONT}`,
          }}
        >
          Access ends immediately. User must complete secure sign-in again.
        </div>
      </DcModal>
    </>
  )
}

function SecurityKpis({
  logins,
  failed,
  sessions,
  twoFaEnabled,
  adminCount,
  coverage,
  level,
}: {
  logins: number
  failed: number
  sessions: number
  twoFaEnabled: number
  adminCount: number
  coverage: number
  level?: string | undefined
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
        gap: 12,
      }}
    >
      <Kpi
        icon="icon-log-in"
        label="Logins · 24h"
        value={String(logins)}
        sub={`${adminCount} admin account${adminCount === 1 ? '' : 's'}`}
        tone="info"
      />
      <Kpi
        icon="icon-shield-alert"
        label="Failed attempts"
        value={String(failed)}
        sub={`Threat level · ${threatLabel(level)}`}
        tone={threatTone(level)}
      />
      <Kpi
        icon="icon-monitor-smartphone"
        label="Active sessions"
        value={String(sessions)}
        sub="Verified device sessions"
        tone="vio"
      />
      <Kpi
        icon="icon-send"
        label="Telegram 2FA"
        value={`${twoFaEnabled} of ${adminCount}`}
        sub={`${coverage}% coverage`}
        tone={coverage === 100 ? 'ok' : 'warn'}
      />
    </div>
  )
}

function Kpi({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: string
  label: string
  value: string
  sub: string
  tone: DcTone
}) {
  const colors = toneStyle(tone)
  return (
    <div
      style={{
        ...card,
        minHeight: 105,
        padding: '14px 15px',
        display: 'grid',
        gridTemplateColumns: '34px minmax(0, 1fr)',
        columnGap: 11,
        rowGap: 7,
        alignItems: 'center',
      }}
    >
      <span
        style={{
          gridRow: '1 / span 2',
          width: 34,
          height: 34,
          display: 'grid',
          placeItems: 'center',
          border: `1px solid ${colors.bd}`,
          borderRadius: 9,
          background: colors.bg,
          color: colors.fg,
        }}
      >
        <DcIcon name={icon} size={15} />
      </span>
      <span style={capsLabel}>{label}</span>
      <span
        style={{
          font: `700 25px/1 ${FONT}`,
          letterSpacing: '-.025em',
          color: 'var(--ink)',
        }}
      >
        {value}
      </span>
      <span
        style={{
          gridColumn: '1 / -1',
          paddingTop: 2,
          font: `400 11.5px/1.3 ${FONT}`,
          color: colors.fg,
        }}
      >
        {sub}
      </span>
    </div>
  )
}

function SectionTitle({
  icon,
  title,
  meta,
}: {
  icon: string
  title: string
  meta?: string | undefined
}) {
  return (
    <div
      style={{
        minHeight: 50,
        padding: '11px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: '1px solid var(--line)',
      }}
    >
      <span
        style={{
          width: 29,
          height: 29,
          display: 'grid',
          placeItems: 'center',
          border: '1px solid var(--violet-bd)',
          borderRadius: 8,
          background: 'var(--violet-soft)',
          color: 'var(--violet)',
        }}
      >
        <DcIcon name={icon} size={14} />
      </span>
      <span style={{ flex: 1, font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>{title}</span>
      {meta ? <span style={{ font: `500 10.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>{meta}</span> : null}
    </div>
  )
}

function AuditLog({ rows }: { rows: AuditRow[] }) {
  return (
    <section style={{ ...card, flex: '2 1 650px', minWidth: 0, overflow: 'hidden' }}>
      <SectionTitle icon="icon-scroll-text" title="Audit log" meta="last 50 events" />
      {rows.length === 0 ? (
        <div
          style={{
            minHeight: 230,
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            textAlign: 'center',
          }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
            <DcIcon name="icon-shield-check" size={24} color="var(--ok)" />
            <strong style={{ font: `600 13px/1 ${FONT}`, color: 'var(--ink)' }}>Audit log is empty</strong>
            <span style={{ font: `400 11.5px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
              Logins, settings changes, refunds, and blocked actions appear here.
            </span>
          </span>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['When', 'Who', 'Action', 'Target', 'Resource', 'Result'].map((label) => (
                  <th key={label} style={{ padding: '9px 13px', textAlign: 'left', ...capsLabel }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={cellStyle}>
                    <span style={{ font: `500 10.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>{row.time}</span>
                  </td>
                  <td style={cellStyle}>
                    <span style={{ font: `600 11.5px/1.2 ${FONT}`, color: 'var(--ink)' }}>{row.actor}</span>
                  </td>
                  <td style={cellStyle}>
                    <span style={{ font: `500 11.5px/1.25 ${FONT}`, color: 'var(--ink-2)' }}>{row.action}</span>
                  </td>
                  <td style={cellStyle}>
                    <span style={{ font: `400 10.5px/1.2 ${MONO}`, color: 'var(--ink-3)' }}>{row.target || '—'}</span>
                  </td>
                  <td style={cellStyle}>
                    <span style={{ font: `400 10.5px/1.2 ${MONO}`, color: 'var(--ink-3)' }}>{row.resource || '—'}</span>
                  </td>
                  <td style={cellStyle}>
                    <MiniBadge
                      label={severityTone(row) === 'bad' ? 'Blocked' : 'OK'}
                      tone={severityTone(row)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function PolicyCard({ rows }: { rows: PostureRow[] }) {
  return (
    <section style={{ ...card, overflow: 'hidden' }}>
      <SectionTitle icon="icon-shield-check" title="Policies" meta={`${rows.length} checks`} />
      <div style={{ padding: '5px 14px' }}>
        {rows.length === 0 ? (
          <p style={{ margin: '16px 0', font: `400 11.5px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
            Server returned no policy checks.
          </p>
        ) : (
          rows.map((row, index) => <PolicyRow key={row.label} row={row} last={index === rows.length - 1} />)
        )}
      </div>
    </section>
  )
}

function PolicyRow({ row, last }: { row: PostureRow; last: boolean }) {
  const tone = toneStyle(row.ok ? 'ok' : 'warn')
  return (
    <div
      style={{
        minHeight: 57,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: last ? 0 : '1px solid var(--line)',
      }}
    >
      <span
        style={{
          width: 26,
          height: 26,
          display: 'grid',
          placeItems: 'center',
          border: `1px solid ${tone.bd}`,
          borderRadius: 8,
          background: tone.bg,
          color: tone.fg,
        }}
      >
        <DcIcon name={row.ok ? 'icon-check' : 'icon-triangle-alert'} size={13} />
      </span>
      <span style={{ flex: 1, minWidth: 0, font: `500 11.5px/1.3 ${FONT}`, color: 'var(--ink-2)' }}>
        {row.label}
      </span>
      <span
        style={{
          maxWidth: 120,
          textAlign: 'right',
          font: `600 10.5px/1.3 ${MONO}`,
          color: tone.fg,
        }}
      >
        {row.value}
      </span>
    </div>
  )
}

function ThreatCard({
  rows,
  level,
}: {
  rows: SecurityData['threats']
  level?: string | undefined
}) {
  const tone = toneStyle(threatTone(level))
  return (
    <section style={{ ...card, overflow: 'hidden' }}>
      <SectionTitle icon="icon-shield-alert" title="Recent threats" meta={threatLabel(level)} />
      {rows.length === 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            padding: '16px 14px',
            background: 'var(--ok-soft)',
          }}
        >
          <DcIcon name="icon-circle-check" size={17} color="var(--ok)" />
          <span style={{ font: `500 11.5px/1.45 ${FONT}`, color: 'var(--ok)' }}>
            No blocked or failed audit events detected.
          </span>
        </div>
      ) : (
        <div style={{ padding: '5px 14px' }}>
          {rows.map((row, index) => (
            <div
              key={row.id}
              style={{
                display: 'flex',
                gap: 9,
                padding: '11px 0',
                borderBottom: index === rows.length - 1 ? 0 : '1px solid var(--line)',
              }}
            >
              <DcIcon name="icon-triangle-alert" size={14} color={tone.fg} />
              <span style={{ flex: 1, font: `500 11.5px/1.35 ${FONT}`, color: 'var(--ink-2)' }}>
                {row.action}
              </span>
              <span style={{ font: `500 10px/1.35 ${MONO}`, color: 'var(--ink-3)' }}>{row.time}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function SessionsCard({
  rows,
  loading,
  error,
  busy,
  onRetry,
  onRevoke,
}: {
  rows: SecuritySessionRow[]
  loading: boolean
  error: unknown
  busy: boolean
  onRetry: () => void
  onRevoke: (row: SecuritySessionRow) => void
}) {
  return (
    <section style={{ ...card, overflow: 'hidden' }}>
      <SectionTitle icon="icon-monitor-smartphone" title="Active device sessions" meta={`${rows.length} active`} />
      {loading ? (
        <div className="dc-skeleton" style={{ height: 112 }} />
      ) : error ? (
        <div style={{ padding: 14 }}>
          <DcErrorState
            error={`GET /admin/security/sessions → ${error instanceof Error ? error.message : 'Request failed'}`}
            hint="No session was changed."
            onRetry={onRetry}
          />
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding: '24px 14px', textAlign: 'center' }}>
          <span style={{ font: `400 11.5px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
            No active device sessions returned by server.
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((row, index) => (
            <div
              key={row.id}
              style={{
                minHeight: 67,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                borderBottom: index === rows.length - 1 ? 0 : '1px solid var(--line)',
              }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  display: 'grid',
                  placeItems: 'center',
                  border: '1px solid var(--line)',
                  borderRadius: 9,
                  background: 'var(--surface-2)',
                  color: 'var(--ink-3)',
                }}
              >
                <DcIcon name="icon-monitor" size={14} />
              </span>
              <span style={{ flex: '1 1 210px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <strong style={{ font: `600 12px/1.2 ${FONT}`, color: 'var(--ink)' }}>
                  {row.user.firstName} {row.user.lastName}
                </strong>
                <span style={{ font: `400 10.5px/1.2 ${FONT}`, color: 'var(--ink-3)' }}>
                  {row.user.email ?? 'No email'} · {sessionDevice(row)}
                </span>
              </span>
              <span style={{ flex: '0 1 190px', font: `400 10.5px/1.4 ${MONO}`, color: 'var(--ink-3)' }}>
                {row.ipAddress ?? 'Unknown IP'}
                <br />
                Last active {stableTime(row.lastActive)}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => onRevoke(row)}
                style={{
                  height: 31,
                  padding: '0 11px',
                  border: '1px solid var(--bad-bd)',
                  borderRadius: 8,
                  background: 'var(--bad-soft)',
                  color: 'var(--bad)',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  font: `600 11px/1 ${FONT}`,
                  opacity: busy ? 0.65 : 1,
                }}
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function MiniBadge({ label, tone }: { label: string; tone: DcTone }) {
  const style = toneStyle(tone)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        padding: '0 8px',
        border: `1px solid ${style.bd}`,
        borderRadius: 6,
        background: style.bg,
        color: style.fg,
        font: `600 10px/1 ${FONT}`,
        letterSpacing: '.035em',
      }}
    >
      {label}
    </span>
  )
}
