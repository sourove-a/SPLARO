'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import { DcModal } from '@/components/dc/DcModal'
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
  const { toast } = useDcScreen()
  const qc = useQueryClient()
  const { api } = useAdminConnection(25_000)

  const dash = useQuery({
    queryKey: ['google-sheets-dashboard'],
    queryFn: fetchSheetsDashboard,
    staleTime: 20_000,
    retry: 1,
  })
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['google-sheets-dashboard'] })

  const syncOne = useMutation({ mutationFn: (t: string) => syncSheet(t), onSuccess: invalidate })
  const syncAll = useMutation({ mutationFn: () => syncAllSheets(), onSuccess: invalidate })
  const retry = useMutation({ mutationFn: retryFailedSheets, onSuccess: invalidate })

  const [confirmAll, setConfirmAll] = useState(false)

  const sheets = useMemo(() => dash.data?.sheets ?? [], [dash.data])
  const stats = dash.data?.stats
  const conn = dash.data?.connection
  const pageStatus = dcPageStatus([dash], api.pulse)

  const failing = sheets.filter((s) => statusTone(s) === 'bad')
  const unconfigured = sheets.filter((s) => !s.configured)
  const neverSynced = sheets.filter((s) => s.configured && !s.lastSync)

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
              ? `${stats.configured} of ${stats.total} tabs set up`
              : 'no tabs reported'
        }
        syncing={dash.isFetching}
        onSync={() => void dash.refetch()}
        actions={[
          ...(failing.length > 0
            ? [
                {
                  label: `Retry ${failing.length} failed`,
                  icon: 'icon-refresh-cw',
                  onClick: () =>
                    retry.mutate(undefined, {
                      onSuccess: () =>
                        toast(
                          'ok',
                          'Retry queued',
                          'Only the tabs that failed were re-pushed. Watch the status below.',
                        ),
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
      ) : (
        <>
          {/* Connection honesty comes before any number on this page. */}
          <div
            style={{
              ...card,
              borderLeft: `3px solid ${
                conn?.workspaceConnected && conn?.spreadsheetLinked ? 'var(--ok)' : 'var(--warn)'
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
                color:
                  conn?.workspaceConnected && conn?.spreadsheetLinked
                    ? 'var(--ok)'
                    : 'var(--warn)',
              }}
            >
              <DcIcon
                name={
                  conn?.workspaceConnected && conn?.spreadsheetLinked
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
                  : !conn.workspaceConnected
                    ? 'Nothing syncs until a Google account is authorised. Every button below will fail with an auth error.'
                    : !conn.spreadsheetLinked
                      ? 'The account is authorised but no spreadsheet is linked, so there is nowhere to write.'
                      : `Sync is one-way: SPLARO overwrites the sheet. Editing the sheet never changes SPLARO. Auto-sync is ${conn.autoSyncEnabled ? 'on' : 'off'}${conn.tokenHealth ? ` · token ${conn.tokenHealth.toLowerCase()}` : ''}.`}
              </span>
            </span>
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
              {conn?.setupHref ? (
                <a
                  href={conn.setupHref}
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
                  <DcIcon name="icon-settings" size={13} />
                  <span>Connection settings</span>
                </a>
              ) : null}
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
                  ? 'the sheet is stale for these'
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
                gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
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
                          onSuccess: () =>
                            toast(
                              'ok',
                              `${prettySheet(s.sheetType)} pushed`,
                              'The tab now matches SPLARO. Anything typed into it by hand is gone.',
                            ),
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
