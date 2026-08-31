'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import { DcField, DcModal } from '@/components/dc/DcModal'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import {
  fetchSheetsDashboard,
  retryFailedSheets,
  syncAllSheets,
  syncSheet,
  type SheetsDashboardSheet,
} from '@/lib/api/finance'
import {
  createDefaultSpreadsheet,
  fetchGoogleOAuthUrl,
  fetchGoogleSyncLogs,
  linkGoogleSpreadsheet,
} from '@/lib/api/google-workspace'
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

/** What each tab in the spreadsheet is actually for, in the operator's words. */
const SHEET_PURPOSE: Record<string, string> = {
  ORDERS: 'Every order with customer, courier and payment state — the tab accountants ask for.',
  HISAB: 'Daily hisab: cash in, cash out, and what is left at the end of the day.',
  PARTNERS: 'Partner balances, investments and withdrawals as of the last sync.',
  STOCK: 'Stock on hand per SKU, so a stocktake can be done off a phone.',
  EXPENSES: 'Approved expenses by category and who spent it.',
  PRODUCTS: 'Catalogue with cost and retail price per SKU.',
  CUSTOMERS: 'Customer list with order count and lifetime value.',
}

const sheetTh = {
  textAlign: 'left' as const,
  padding: '9px 15px',
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap' as const,
}

function SheetNote({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: '36px 15px',
        textAlign: 'center',
        font: `400 12.5px/1.55 ${FONT}`,
        color: 'var(--ink-3)',
      }}
    >
      {text}
    </div>
  )
}

function purposeOf(sheetType: string): string {
  return (
    SHEET_PURPOSE[sheetType.toUpperCase()] ??
    'Pushed one-way from SPLARO into its own tab in the linked spreadsheet.'
  )
}

function prettySheet(sheetType: string): string {
  return sheetType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function statusTone(sheet: SheetsDashboardSheet): DcTone {
  if (!sheet.configured) return 'mute'
  const s = (sheet.lastStatus ?? '').toUpperCase()
  if (s === 'COMPLETED' || s === 'SUCCESS') return 'ok'
  if (s === 'FAILED' || s === 'ERROR') return 'bad'
  if (s === 'PENDING' || s === 'RUNNING') return 'warn'
  return 'info'
}

/**
 * Auth states only.
 *
 * `degraded` used to be in this list, so a store whose *jobs* had failed was
 * told "Google token needs reconnect" — sending the operator to re-do OAuth
 * for a problem that had nothing to do with the token. Job failures are
 * reported by `jobsFailing` instead.
 */
/** "5 days ago" — so a stored error can never read as something happening now. */
function relativeAge(iso: string | null | undefined): string {
  if (!iso) return 'unknown time'
  const at = new Date(iso).getTime()
  if (Number.isNaN(at)) return 'unknown time'
  const mins = Math.max(0, Math.round((Date.now() - at) / 60000))
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.round(hours / 24)
  return days === 1 ? '1 day ago' : `${days} days ago`
}

function tokenHealthBad(health: string | null | undefined): boolean {
  const h = (health ?? '').toLowerCase()
  return (
    h === 'needs_reconnect' ||
    h === 'expired' ||
    h === 'revoked' ||
    h === 'missing' ||
    h === 'unhealthy'
  )
}

function jobFailed(status: string | null | undefined): boolean {
  const s = (status ?? '').toLowerCase()
  return s === 'failed' || s === 'error'
}

function jobSucceeded(status: string | null | undefined): boolean {
  const s = (status ?? '').toLowerCase()
  return s === 'success' || s === 'completed' || s === 'ok'
}

function isAuthJobError(msg: string | null | undefined): boolean {
  const lower = (msg ?? '').toLowerCase()
  return (
    lower.includes('refresh token') ||
    lower.includes('reconnect your google') ||
    lower.includes('invalid_grant') ||
    lower.includes('expired or revoked')
  )
}

function statusWords(sheet: SheetsDashboardSheet): string {
  if (!sheet.configured) return 'Not set up'
  const s = (sheet.lastStatus ?? '').toUpperCase()
  if (s === 'COMPLETED' || s === 'SUCCESS') return 'Synced'
  if (s === 'FAILED' || s === 'ERROR') return 'Last sync failed'
  if (s === 'PENDING' || s === 'RUNNING') return 'Sync running'
  return 'Never synced'
}

export function DcGoogleSheets() {
  const router = useRouter()
  return (
    <DcScreenProvider
      screen="sheets"
      onNavigate={(next) => router.push(`/dashboard/${next}`)}
    >
      <DcGoogleSheetsBody />
    </DcScreenProvider>
  )
}

function DcGoogleSheetsBody() {
  const router = useRouter()
  const { toast } = useDcScreen()
  const qc = useQueryClient()
  const { api } = useAdminConnection(25_000)

  const dash = useQuery({
    queryKey: ['google-sheets-dashboard'],
    queryFn: fetchSheetsDashboard,
    staleTime: 20_000,
    retry: 1,
  })
  /** The job-by-job history behind the per-tab status above. */
  const logs = useQuery({
    queryKey: ['google-sync-logs'],
    queryFn: () => fetchGoogleSyncLogs(1),
    staleTime: 20_000,
    retry: 1,
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['google-sheets-dashboard'] })
    void qc.invalidateQueries({ queryKey: ['google-sync-logs'] })
  }

  const syncOne = useMutation({ mutationFn: (t: string) => syncSheet(t), onSuccess: invalidate })
  const syncAll = useMutation({ mutationFn: () => syncAllSheets(), onSuccess: invalidate })
  const retry = useMutation({ mutationFn: retryFailedSheets, onSuccess: invalidate })
  const createSheet = useMutation({
    mutationFn: createDefaultSpreadsheet,
    onSuccess: invalidate,
  })
  const linkSheet = useMutation({
    mutationFn: (spreadsheetUrl: string) => linkGoogleSpreadsheet({ spreadsheetUrl }),
    onSuccess: invalidate,
  })

  const [confirmAll, setConfirmAll] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  const sheets = useMemo(() => dash.data?.sheets ?? [], [dash.data])
  const stats = dash.data?.stats
  const conn = dash.data?.connection
  const jobs = logs.data?.items ?? []
  const recentTotal = conn?.recentJobsTotal ?? jobs.length
  const recentFailed = conn?.recentJobsFailed ?? jobs.filter((j) => jobFailed(j.status)).length
  const recentSucceeded =
    conn?.recentJobsSucceeded ?? jobs.filter((j) => jobSucceeded(j.status)).length
  // The API reports when every recent failure predates the last success; in
  // that case the red state describes a version of the store that is gone.
  const failureIsStale = conn?.recentFailureIsStale ?? false
  const jobsFailing = !failureIsStale && recentTotal > 0 && recentFailed * 2 >= recentTotal
  const authBroken =
    tokenHealthBad(conn?.tokenHealth) ||
    (!failureIsStale && jobs.some((j) => jobFailed(j.status) && isAuthJobError(j.errorMsg)))
  const syncFailing = authBroken || jobsFailing
  const pageStatus = dcPageStatus(
    [dash, logs],
    api.pulse,
    syncFailing ? { label: 'SYNC FAILING', tone: 'bad' } : undefined,
  )

  const failing = sheets.filter((s) => statusTone(s) === 'bad')
  const unconfigured = sheets.filter((s) => !s.configured)
  const neverSynced = sheets.filter((s) => s.configured && !s.lastSync)
  const needsSpreadsheet = Boolean(conn?.workspaceConnected && !conn?.spreadsheetLinked)

  const reconnect = useMutation({
    mutationFn: fetchGoogleOAuthUrl,
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url
        return
      }
      toast('bad', 'Reconnect failed', 'No OAuth URL returned')
    },
    onError: (err) =>
      toast('bad', 'Reconnect failed', err instanceof Error ? err.message : 'Could not start Google login'),
  })

  const runCreateSpreadsheet = () => {
    createSheet.mutate(undefined, {
      onSuccess: (res) => {
        if (!res?.spreadsheetId) {
          toast('bad', 'Create failed', 'API did not return a spreadsheet id — nothing was linked.')
          return
        }
        toast(
          'ok',
          'Spreadsheet created',
          res.spreadsheetUrl
            ? 'Linked to this store. Open it from the banner above.'
            : 'Linked to this store.',
        )
      },
      onError: (err) =>
        toast('bad', 'Create failed', err instanceof Error ? err.message : 'Check Google connection'),
    })
  }

  const runLinkSpreadsheet = () => {
    const url = linkUrl.trim()
    if (!url) {
      toast('warn', 'URL required', 'Paste a Google Sheets URL or spreadsheet id.')
      return
    }
    linkSheet.mutate(url, {
      onSuccess: (res) => {
        if (!res?.spreadsheetId && !res?.linked) {
          toast('bad', 'Link failed', 'Server did not confirm the spreadsheet link.')
          return
        }
        setLinkOpen(false)
        setLinkUrl('')
        toast('ok', 'Spreadsheet linked', 'Tabs can sync into this workbook now.')
      },
      onError: (err) =>
        toast('bad', 'Link failed', err instanceof Error ? err.message : 'Check the URL and sharing'),
    })
  }

  const skeleton: DcBlock[] = [
    { t: 'kpis' } as DcBlock,
    { t: 'banner', text: '' } as DcBlock,
    { t: 'cards', w: 'full', title: '', items: [] } as DcBlock,
  ]

  return (
    <>
      <DcPageHead
        crumbGroup="Integrations"
        title="Google Sheets"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          dash.isFetching
            ? 'syncing…'
            : stats
              ? `${stats.configured} of ${stats.total} tabs set up${
                  recentTotal > 0
                    ? ` · ${recentSucceeded}/${recentTotal} last jobs succeeded`
                    : // Job rows and per-tab rows are two different tables, and
                      // the tabs below are pushed without always writing a job
                      // row. Reading only the job table put "no sync run in the
                      // last 7 days" directly above twelve tabs stamped minutes
                      // ago, so the tab's own timestamp answers when it can.
                      conn?.lastSyncAt
                      ? ` · last synced ${relativeAge(conn.lastSyncAt)}`
                      : ' · no sync run in the last 7 days'
                }`
              : 'no tabs reported'
        }
        syncing={dash.isFetching}
        onSync={() => {
          void dash.refetch()
          void logs.refetch()
        }}
        actions={[
          ...(failing.length > 0
            ? [
                {
                  label: `Retry ${failing.length} failed`,
                  icon: 'icon-refresh-cw',
                  onClick: () =>
                    retry.mutate(undefined, {
                      onSuccess: (res) => {
                        const msg =
                          res && typeof res === 'object' && 'message' in res
                            ? String((res as { message?: string }).message ?? '')
                            : ''
                        const queued =
                          res &&
                          typeof res === 'object' &&
                          'queued' in res &&
                          (res as { queued?: boolean }).queued === false
                        if (queued) {
                          toast('warn', 'Retry not queued', msg || 'Could not start re-sync')
                          return
                        }
                        toast(
                          'ok',
                          'Retry queued',
                          msg || 'Full spreadsheet re-sync started. Watch tab status below.',
                        )
                      },
                      onError: (err) =>
                        toast(
                          'bad',
                          'Retry failed',
                          err instanceof Error
                            ? err.message
                            : 'POST /google-sheets/retry-failed failed',
                        ),
                    }),
                },
              ]
            : []),
          {
            label: 'Sync everything',
            icon: 'icon-upload-cloud',
            variant: 'primary' as const,
            onClick: () => setConfirmAll(true),
          },
        ]}
      />

      {dash.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : dash.error ? (
        <DcErrorState
          error={`GET /google-sheets/dashboard → ${dash.error instanceof Error ? dash.error.message : '500 Internal Server Error'}`}
          hint="Nothing was pushed or lost — the spreadsheet still holds whatever the last successful sync wrote."
          onRetry={() => void dash.refetch()}
        />
      ) : jobs.length === 0 ? (
        <DcEmptyState
          icon="icon-table"
          title="No sync runs recorded yet"
          body="Orders, Hisab, Partners and Stock tabs are written to Sheets on a 15-minute cron. Nothing has synced yet — check the connection below, or wait for the next run."
        />
      ) : (
        <>
          {/* Connection honesty comes before any number on this page. */}
          <div
            style={{
              ...card,
              borderLeft: `3px solid ${
                syncFailing
                  ? 'var(--bad)'
                  : conn?.workspaceConnected && conn?.spreadsheetLinked
                    ? 'var(--ok)'
                    : 'var(--warn)'
              }`,
              padding: '14px 16px',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 30,
                height: 30,
                flex: 'none',
                borderRadius: 9,
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
                color: syncFailing
                  ? 'var(--bad)'
                  : conn?.workspaceConnected && conn?.spreadsheetLinked
                    ? 'var(--ok)'
                    : 'var(--warn)',
              }}
            >
              <DcIcon
                name={
                  syncFailing
                    ? 'icon-alert-triangle'
                    : conn?.workspaceConnected && conn?.spreadsheetLinked
                      ? 'icon-check-circle'
                      : 'icon-link-2-off'
                }
                size={14}
              />
            </span>
            <span
              style={{
                flex: '1 1 260px',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
              }}
            >
              <span style={{ font: `600 13.5px/1.35 ${FONT}`, color: 'var(--ink)' }}>
                {!conn
                  ? 'Connection state not reported by the API'
                  : authBroken
                    ? 'Google token needs reconnect'
                    : jobsFailing
                      ? 'Recent sync jobs are failing'
                      : !conn.workspaceConnected
                        ? 'Google account not connected'
                        : !conn.spreadsheetLinked
                          ? 'Connected, but no spreadsheet linked'
                          : `Pushing into a spreadsheet as ${conn.googleEmail ?? 'the connected account'}`}
              </span>
              <span
                style={{ font: `400 12.5px/1.55 ${FONT}`, color: 'var(--ink-3)', textWrap: 'pretty' }}
              >
                {!conn
                  ? 'The dashboard endpoint returned no connection block, so this screen cannot say whether a sync would land.'
                  : authBroken
                    ? conn.lastError ||
                      'Last sync jobs failed because the Google refresh token is missing or expired. Reconnect the account — a linked email is not enough.'
                    : jobsFailing
                      ? `${recentFailed}/${recentTotal} recent jobs failed. Auto-sync is ${conn.autoSyncEnabled ? 'on' : 'off'} · token ${conn.tokenHealth ?? 'unknown'}.`
                      : !conn.workspaceConnected
                        ? 'Nothing syncs until a Google account is authorised. Every button below will fail with an auth error.'
                        : !conn.spreadsheetLinked
                          ? 'The account is authorised but no spreadsheet is linked, so there is nowhere to write.'
                          : `PostgreSQL is the store database. Sheets is a one-way backup export — editing the sheet never changes SPLARO. Auto-sync is ${conn.autoSyncEnabled ? 'on' : 'off'}${conn.tokenHealth ? ` · token ${conn.tokenHealth.toLowerCase()}` : ''}${
                              failureIsStale && conn.lastError
                                ? ` · last failure (${relativeAge(logs.data?.items?.find((j) => jobFailed(j.status))?.createdAt)}) is older than the last successful sync and is kept only as history.`
                                : ''
                            }`}
              </span>
            </span>
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {authBroken ? (
                <button
                  type="button"
                  disabled={reconnect.isPending}
                  onClick={() => reconnect.mutate()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    height: 32,
                    padding: '0 12px',
                    borderRadius: 9,
                    border: '1px solid var(--bad)',
                    background: 'var(--surface-2)',
                    color: 'var(--bad)',
                    font: `600 12px/1 ${FONT}`,
                    cursor: reconnect.isPending ? 'wait' : 'pointer',
                  }}
                >
                  <DcIcon name="icon-link" size={13} />
                  <span>{reconnect.isPending ? 'Opening Google…' : 'Reconnect Google'}</span>
                </button>
              ) : null}
              {needsSpreadsheet ? (
                <>
                  <button
                    type="button"
                    disabled={createSheet.isPending || linkSheet.isPending}
                    onClick={runCreateSpreadsheet}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      height: 32,
                      padding: '0 12px',
                      borderRadius: 9,
                      border: '1px solid var(--violet-solid)',
                      background: 'var(--violet-solid)',
                      color: 'var(--on-violet)',
                      font: `600 12px/1 ${FONT}`,
                      cursor: createSheet.isPending ? 'wait' : 'pointer',
                    }}
                  >
                    <DcIcon name="icon-plus" size={13} />
                    <span>{createSheet.isPending ? 'Creating…' : 'Create spreadsheet'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={createSheet.isPending || linkSheet.isPending}
                    onClick={() => setLinkOpen(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      height: 32,
                      padding: '0 12px',
                      borderRadius: 9,
                      border: '1px solid var(--line-2)',
                      background: 'var(--surface-2)',
                      color: 'var(--ink-2)',
                      font: `600 12px/1 ${FONT}`,
                      cursor: 'pointer',
                    }}
                  >
                    <DcIcon name="icon-link" size={13} />
                    <span>Link existing</span>
                  </button>
                </>
              ) : null}
              {conn?.spreadsheetUrl ? (
                <a
                  href={conn.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    height: 32,
                    padding: '0 12px',
                    borderRadius: 9,
                    border: '1px solid var(--line-2)',
                    color: 'var(--ink-2)',
                    font: `600 12px/1 ${FONT}`,
                  }}
                >
                  <DcIcon name="icon-external-link" size={13} />
                  <span>Open spreadsheet</span>
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => setLinkOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  height: 32,
                  padding: '0 12px',
                  borderRadius: 9,
                  border: '1px solid var(--line-2)',
                  background: 'transparent',
                  color: 'var(--ink-2)',
                  font: `600 12px/1 ${FONT}`,
                  cursor: 'pointer',
                }}
              >
                <DcIcon name="icon-link" size={13} />
                <span>{conn?.spreadsheetLinked ? 'Change link' : 'Link spreadsheet'}</span>
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/google-workspace/connect')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  height: 32,
                  padding: '0 12px',
                  borderRadius: 9,
                  border: '1px solid var(--line-2)',
                  background: 'transparent',
                  color: 'var(--ink-2)',
                  font: `600 12px/1 ${FONT}`,
                  cursor: 'pointer',
                }}
              >
                <DcIcon name="icon-settings" size={13} />
                <span>Connection settings</span>
              </button>
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(206px, 1fr))',
              gap: 12,
            }}
          >
            <Kpi
              label="Tabs set up"
              value={`${stats?.configured ?? 0} / ${stats?.total ?? sheets.length}`}
              sub={
                unconfigured.length > 0
                  ? `${unconfigured.length} tab${unconfigured.length === 1 ? '' : 's'} would be skipped`
                  : 'every tab has a destination'
              }
              color={unconfigured.length > 0 ? 'var(--warn)' : undefined}
            />
            <Kpi
              label="Last run succeeded"
              value={String(stats?.completed ?? 0)}
              sub="tabs whose last push landed"
              color="var(--ok)"
            />
            <Kpi
              label="Failed"
              value={String(stats?.failed ?? failing.length)}
              sub={
                failing.length > 0
                  ? 'last push failed — use Retry or Sync everything'
                  : 'nothing failed on the last run'
              }
              color={(stats?.failed ?? failing.length) > 0 ? 'var(--bad)' : undefined}
            />
            <Kpi
              label="Never synced"
              value={String(neverSynced.length)}
              sub="set up but never pushed once"
              color={neverSynced.length > 0 ? 'var(--warn)' : undefined}
            />
          </div>

          <div style={{ ...card, overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 9,
                flexWrap: 'wrap',
                padding: '12px 15px',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <span
                style={{ flex: 1, minWidth: 130, font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}
              >
                Tabs
              </span>
              <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                one-way: SPLARO overwrites the sheet
              </span>
            </div>
            <div
              style={{
                padding: 12,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(330px, 100%), 1fr))',
                gap: 10,
              }}
            >
              {sheets.map((s) => {
                const tone = toneStyle(statusTone(s))
                const busy = syncOne.isPending && syncOne.variables === s.sheetType
                return (
                  <div
                    key={s.sheetType}
                    style={{
                      border: '1px solid var(--line)',
                      borderLeft: `3px solid ${tone.fg}`,
                      borderRadius: 11,
                      background: 'var(--surface-2)',
                      padding: '12px 13px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 9,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          font: `600 13px/1.35 ${FONT}`,
                          color: 'var(--ink)',
                        }}
                      >
                        {prettySheet(s.sheetType)}
                      </span>
                      {/* Rule 6: icon + worded badge, plus a worded button below. */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          flex: 'none',
                          padding: '3px 8px',
                          borderRadius: 6,
                          border: `1px solid ${tone.bd}`,
                          background: tone.bg,
                          color: tone.fg,
                          font: `600 10.5px/1.3 ${FONT}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <DcIcon
                          name={
                            statusTone(s) === 'ok'
                              ? 'icon-check-circle'
                              : statusTone(s) === 'bad'
                                ? 'icon-alert-triangle'
                                : statusTone(s) === 'warn'
                                  ? 'icon-clock'
                                  : 'icon-minus-circle'
                          }
                          size={11}
                        />
                        {statusWords(s)}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 8,
                        flexWrap: 'wrap',
                        padding: '9px 10px',
                        border: '1px solid var(--line)',
                        borderRadius: 9,
                        background: 'var(--surface)',
                      }}
                    >
                      <span style={{ font: `600 12px/1.3 ${MONO}`, color: 'var(--ink)' }}>
                        {s.lastSync
                          ? new Date(s.lastSync).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'never pushed'}
                      </span>
                      <span style={{ font: `500 11px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                        {s.configured
                          ? `set up via ${s.configuredVia ?? 'unknown source'}`
                          : 'no destination tab configured'}
                      </span>
                    </div>

                    <span
                      style={{
                        font: `400 11.5px/1.55 ${FONT}`,
                        color: 'var(--ink-3)',
                        textWrap: 'pretty',
                      }}
                    >
                      {purposeOf(s.sheetType)}
                    </span>

                    {s.lastError ? (
                      <span
                        style={{
                          padding: '8px 10px',
                          borderRadius: 9,
                          border: '1px solid var(--bad-bd)',
                          background: 'var(--bad-soft)',
                          color: 'var(--bad)',
                          font: `400 11px/1.5 ${MONO}`,
                          wordBreak: 'break-word',
                        }}
                      >
                        {s.lastError}
                      </span>
                    ) : null}

                    <button
                      type="button"
                      disabled={!s.configured || busy || syncAll.isPending}
                      onClick={() =>
                        syncOne.mutate(s.sheetType, {
                          onSuccess: (res) => {
                            const queued =
                              res &&
                              typeof res === 'object' &&
                              'queued' in res &&
                              (res as { queued?: boolean }).queued === false
                            if (queued) {
                              toast(
                                'warn',
                                `${prettySheet(s.sheetType)} not queued`,
                                String((res as { reason?: string }).reason ?? 'Sync did not start'),
                              )
                              return
                            }
                            toast(
                              'ok',
                              `${prettySheet(s.sheetType)} pushed`,
                              'The tab now matches SPLARO. Anything typed into it by hand is gone.',
                            )
                          },
                          onError: (err) =>
                            toast(
                              'bad',
                              `${prettySheet(s.sheetType)} sync failed`,
                              err instanceof Error
                                ? err.message
                                : 'POST /google-sheets/sync failed',
                            ),
                        })
                      }
                      style={{
                        alignSelf: 'flex-start',
                        height: 30,
                        padding: '0 12px',
                        borderRadius: 8,
                        border: `1px solid ${s.configured ? 'var(--violet-solid)' : 'var(--line-2)'}`,
                        background: s.configured ? 'var(--violet-solid)' : 'transparent',
                        color: s.configured ? 'var(--on-violet)' : 'var(--ink-3)',
                        cursor: !s.configured || busy ? 'not-allowed' : 'pointer',
                        opacity: !s.configured || busy ? 0.6 : 1,
                        font: `600 11.5px/1 ${FONT}`,
                      }}
                    >
                      {!s.configured
                        ? 'Cannot sync — not set up'
                        : busy
                          ? 'Pushing…'
                          : 'Push this tab now'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              alignItems: 'flex-start',
              width: '100%',
            }}
          >
            <div style={{ flex: '1 1 58%', minWidth: 340, maxWidth: '100%' }}>
              <div style={{ ...card, overflow: 'auto' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 9,
                    flexWrap: 'wrap',
                    padding: '12px 15px',
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 130,
                      font: `600 13.5px/1.3 ${FONT}`,
                      color: 'var(--ink)',
                    }}
                  >
                    Sync jobs
                  </span>
                  <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                    {logs.error
                      ? 'log unavailable'
                      : `${jobs.length} most recent · GoogleSyncLog`}
                  </span>
                </div>
                {logs.isLoading ? (
                  <SheetNote text="Loading the job history…" />
                ) : logs.error ? (
                  <SheetNote
                    text={`GET /admin/google/sync-logs → ${logs.error instanceof Error ? logs.error.message : 'request failed'}`}
                  />
                ) : jobs.length === 0 ? (
                  <SheetNote text="No sync job has run yet. The per-tab cards above stay empty until one does." />
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={sheetTh}>Job</th>
                        <th style={sheetTh}>Tab</th>
                        <th style={{ ...sheetTh, textAlign: 'right' }}>Rows</th>
                        <th style={sheetTh}>Ran</th>
                        <th style={sheetTh}>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((j) => {
                        const s = (j.status ?? '').toUpperCase()
                        const tone = toneStyle(
                          s === 'COMPLETED' || s === 'SUCCESS'
                            ? 'ok'
                            : s === 'FAILED' || s === 'ERROR'
                              ? 'bad'
                              : s === 'PENDING' || s === 'RUNNING'
                                ? 'warn'
                                : 'mute',
                        )
                        const when = j.syncedAt ?? j.createdAt
                        return (
                          <tr key={j.id} style={{ borderBottom: '1px solid var(--line)' }}>
                            <td
                              style={{
                                padding: '10px 15px',
                                font: `500 12.5px/1.35 ${FONT}`,
                                color: 'var(--ink)',
                              }}
                            >
                              <span
                                style={{ display: 'flex', flexDirection: 'column', gap: 3 }}
                              >
                                <span>{prettySheet(j.jobType)}</span>
                                {j.triggeredBy ? (
                                  <span
                                    style={{
                                      font: `400 11px/1.3 ${FONT}`,
                                      color: 'var(--ink-3)',
                                    }}
                                  >
                                    by {j.triggeredBy}
                                  </span>
                                ) : null}
                              </span>
                            </td>
                            <td
                              style={{
                                padding: '10px 15px',
                                font: `500 12px/1 ${MONO}`,
                                color: 'var(--ink-2)',
                              }}
                            >
                              {j.sheetTab ?? '—'}
                            </td>
                            <td
                              style={{
                                padding: '10px 15px',
                                textAlign: 'right',
                                font: `500 12.5px/1 ${MONO}`,
                                color: 'var(--ink-2)',
                              }}
                            >
                              {j.rowNumber ?? '—'}
                            </td>
                            <td
                              style={{
                                padding: '10px 15px',
                                font: `400 12px/1 ${FONT}`,
                                color: 'var(--ink-3)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {new Date(when).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td style={{ padding: '10px 15px' }}>
                              <span
                                style={{ display: 'flex', flexDirection: 'column', gap: 5 }}
                              >
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignSelf: 'flex-start',
                                    alignItems: 'center',
                                    gap: 5,
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    border: `1px solid ${tone.bd}`,
                                    background: tone.bg,
                                    color: tone.fg,
                                    font: `600 11px/1 ${FONT}`,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {j.status}
                                  {j.retryCount > 0 ? ` · ${j.retryCount} retries` : ''}
                                </span>
                                {j.errorMsg ? (
                                  <span
                                    style={{
                                      font: `400 11px/1.45 ${MONO}`,
                                      color: 'var(--bad)',
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    {j.errorMsg}
                                  </span>
                                ) : null}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div style={{ flex: '1 1 30%', minWidth: 290, maxWidth: '100%' }}>
              <div style={{ ...card, padding: '6px 16px 10px' }}>
                <div style={{ padding: '12px 0 9px' }}>
                  <span style={{ font: `600 13.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                    If a sync fails
                  </span>
                </div>
                {[
                  {
                    icon: 'icon-refresh-cw',
                    title: 'Retry only what failed',
                    sub: 'POST /google-sheets/retry-failed — the button appears in the header when there is something to retry',
                  },
                  {
                    icon: 'icon-file-text',
                    title: 'Read the provider error',
                    sub: 'the red line on a job row is what Google returned, unedited',
                  },
                  {
                    icon: 'icon-clock',
                    title: 'A 429 means too often, not broken',
                    sub: 'Google caps writes per minute — space the syncs out rather than retrying in a loop',
                  },
                  {
                    icon: 'icon-link-2-off',
                    title: 'Auth errors need the connection, not a retry',
                    sub: 'if the account or spreadsheet link dropped, every retry fails the same way',
                  },
                ].map((r) => (
                  <div
                    key={r.title}
                    style={{
                      display: 'flex',
                      gap: 11,
                      padding: '10px 0',
                      borderTop: '1px solid var(--line)',
                    }}
                  >
                    <span
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 28,
                        height: 28,
                        flex: 'none',
                        borderRadius: 8,
                        border: '1px solid var(--line)',
                        background: 'var(--surface-2)',
                        color: 'var(--ink-2)',
                      }}
                    >
                      <DcIcon name={r.icon} size={13} />
                    </span>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                      }}
                    >
                      <span style={{ font: `600 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                        {r.title}
                      </span>
                      <span
                        style={{
                          font: `400 11.5px/1.45 ${FONT}`,
                          color: 'var(--ink-3)',
                          textWrap: 'pretty',
                        }}
                      >
                        {r.sub}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <DcModal
        open={confirmAll}
        title="Push every tab now?"
        subtitle="Each configured tab is overwritten with current SPLARO data. Anything typed into the spreadsheet by hand is lost."
        confirmLabel="Push everything"
        busy={syncAll.isPending}
        onClose={() => setConfirmAll(false)}
        onConfirm={() =>
          syncAll.mutate(undefined, {
            onSuccess: () => {
              setConfirmAll(false)
              toast(
                'ok',
                'Full sync queued',
                'Every configured tab was re-pushed. Failures show on the cards below.',
              )
            },
            onError: (err) => {
              setConfirmAll(false)
              toast(
                'bad',
                'Full sync failed',
                err instanceof Error ? err.message : 'POST /google-sheets/sync-all failed',
              )
            },
          })
        }
      />

      <DcModal
        open={linkOpen}
        title="Link existing spreadsheet"
        subtitle="Paste a Google Sheets URL or spreadsheet id. Share Editor access with the connected Google account or service account."
        confirmLabel={linkSheet.isPending ? 'Linking…' : 'Link spreadsheet'}
        busy={linkSheet.isPending}
        onClose={() => !linkSheet.isPending && setLinkOpen(false)}
        onConfirm={runLinkSpreadsheet}
      >
        <DcField
          label="Spreadsheet URL or ID"
          value={linkUrl}
          onChange={setLinkUrl}
          placeholder="https://docs.google.com/spreadsheets/d/…"
          mono
        />
      </DcModal>
    </>
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
  color?: string | undefined
}) {
  return (
    <div
      style={{ ...card, padding: '14px 15px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <span style={capsLabel}>{label}</span>
      <span
        style={{ font: `700 25px/1 ${FONT}`, letterSpacing: '-.025em', color: color ?? 'var(--ink)' }}
      >
        {value}
      </span>
      <span style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
    </div>
  )
}
