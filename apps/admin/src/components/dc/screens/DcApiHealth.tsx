'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import {
  healthSummary,
  runAllHealthChecks,
  type HealthScope,
  type HealthStatus,
  type ServiceHealthCheck,
} from '@/lib/api/health'

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

const STATUS_TONE: Record<HealthStatus, DcTone> = {
  healthy: 'ok',
  degraded: 'warn',
  down: 'bad',
  checking: 'mute',
}

const STATUS_ICON: Record<HealthStatus, string> = {
  healthy: 'icon-circle-check',
  degraded: 'icon-triangle-alert',
  down: 'icon-circle-x',
  checking: 'icon-loader',
}

export function DcApiHealth() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="apihealth" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcApiHealthBody />
    </DcScreenProvider>
  )
}

function DcApiHealthBody() {
  const { toast } = useDcScreen()
  const [checks, setChecks] = useState<ServiceHealthCheck[]>([])
  const [scope, setScope] = useState<HealthScope>('core')
  const [running, setRunning] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ranAt, setRanAt] = useState<Date | null>(null)

  const run = useCallback(
    async (nextScope: HealthScope) => {
      setRunning(true)
      setScope(nextScope)
      setError(null)
      // Keep the previous rows visible while re-probing, marked checking, so the
      // page never blanks out mid-run.
      setChecks((prev) =>
        prev.map((c) => ({ ...c, status: 'checking' as HealthStatus, latencyMs: null })),
      )
      try {
        const results = await runAllHealthChecks(nextScope)
        setChecks(results)
        setRanAt(new Date())
      } catch (err) {
        const timedOut = err instanceof Error && err.name === 'TimeoutError'
        setError(
          timedOut
            ? `GET /api/health?scope=${nextScope} → timed out after ${nextScope === 'full' ? 90 : 20}s`
            : `GET /api/health?scope=${nextScope} → ${err instanceof Error ? err.message : 'request failed'}`,
        )
      } finally {
        setRunning(false)
      }
    },
    [],
  )

  useEffect(() => {
    void run('core')
  }, [run])

  const summary = useMemo(() => healthSummary(checks), [checks])

  const avgLatency = useMemo(() => {
    const withLatency = checks.filter((c) => c.latencyMs != null)
    if (withLatency.length === 0) return null
    return Math.round(
      withLatency.reduce((sum, c) => sum + (c.latencyMs ?? 0), 0) / withLatency.length,
    )
  }, [checks])

  const grouped = useMemo(() => {
    const map = new Map<string, ServiceHealthCheck[]>()
    for (const c of checks) {
      const list = map.get(c.group) ?? []
      list.push(c)
      map.set(c.group, list)
    }
    return [...map.entries()]
  }, [checks])

  const broken = useMemo(
    () => checks.filter((c) => c.status === 'down' || c.status === 'degraded'),
    [checks],
  )

  const overallTone = toneStyle(STATUS_TONE[summary.overall])

  const skeleton: DcBlock[] = [
    { t: 'kpis' } as DcBlock,
    { t: 'decide', title: '', items: [] } as DcBlock,
    { t: 'list', title: '', items: [] } as DcBlock,
  ]

  return (
    <>
      <DcPageHead
        crumbGroup="Integrations"
        title="API Health"
        statusLabel={
          summary.overall === 'checking'
            ? 'PROBING'
            : summary.overall === 'healthy'
              ? 'HEALTHY'
              : summary.overall.toUpperCase()
        }
        statusTone={STATUS_TONE[summary.overall]}
        syncLabel={
          running
            ? `probing ${scope} scope…`
            : ranAt
              ? `${scope} scope · ${checks.length} checks · ${ranAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'not probed yet'
        }
        syncing={running}
        onSync={() => void run(scope)}
        actions={[
          {
            label: 'Core probe',
            icon: 'icon-activity',
            onClick: () => void run('core'),
          },
          {
            label: 'Full probe',
            icon: 'icon-radar',
            variant: 'primary',
            onClick: () => {
              toast(
                'info',
                'Full probe started',
                'It touches every integration and can take up to 90 seconds.',
              )
              void run('full')
            },
          },
        ]}
      />

      {error ? (
        <DcErrorState
          error={error}
          hint="The storefront may still be serving cached pages. A failed probe does not mean the store is down."
          onRetry={() => void run(scope)}
        />
      ) : checks.length === 0 && running ? (
        <DcLoadingState blocks={skeleton} />
      ) : checks.length === 0 ? (
        <DcErrorState
          error={`GET /api/health?scope=${scope} → 200 with no checks`}
          hint="The probe answered but returned an empty check list, which usually means the worker is not running."
          onRetry={() => void run(scope)}
        />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(206px, 1fr))',
              gap: 12,
            }}
          >
            <Kpi
              label="Overall"
              value={summary.overall === 'checking' ? 'Probing' : summary.overall}
              sub={`${summary.total} service${summary.total === 1 ? '' : 's'} checked`}
              color={overallTone.fg}
            />
            <Kpi label="Healthy" value={String(summary.healthy)} sub="responding normally" color="var(--ok)" />
            <Kpi
              label="Degraded"
              value={String(summary.degraded)}
              sub="slow or partially failing"
              color={summary.degraded > 0 ? 'var(--warn)' : 'var(--ink)'}
            />
            <Kpi
              label="Down"
              value={String(summary.down)}
              sub={avgLatency != null ? `avg ${avgLatency}ms across probes` : 'no latency reading'}
              color={summary.down > 0 ? 'var(--bad)' : 'var(--ink)'}
            />
          </div>

          {broken.length > 0 ? (
            <div style={{ ...card, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '13px 16px',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 9,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                  Needs attention
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 60,
                    font: `400 11.5px/1.4 ${FONT}`,
                    color: 'var(--ink-3)',
                  }}
                >
                  each card shows the endpoint that failed and what the probe reported
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
                {broken.map((c) => {
                  const t = toneStyle(STATUS_TONE[c.status])
                  return (
                    <div
                      key={c.id}
                      style={{
                        border: '1px solid var(--line)',
                        borderLeft: `3px solid ${t.fg}`,
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
                          {c.name}
                        </span>
                        <span
                          style={{
                            flex: 'none',
                            font: `400 10.5px/1.5 ${MONO}`,
                            color: 'var(--ink-3)',
                          }}
                        >
                          {c.group}
                        </span>
                      </div>

                      <span
                        style={{
                          alignSelf: 'flex-start',
                          padding: '3px 8px',
                          borderRadius: 6,
                          border: `1px solid ${t.bd}`,
                          background: t.bg,
                          color: t.fg,
                          font: `700 9.5px/1.3 ${FONT}`,
                          letterSpacing: '.07em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {c.status}
                        {c.latencyMs != null ? ` · ${c.latencyMs}ms` : ''}
                      </span>

                      {/* The probe's own message and endpoint, verbatim. */}
                      <code
                        style={{
                          display: 'block',
                          padding: '9px 10px',
                          border: '1px solid var(--line)',
                          borderRadius: 9,
                          background: 'var(--surface)',
                          font: `500 11.5px/1.5 ${MONO}`,
                          color: 'var(--ink)',
                          overflowX: 'auto',
                        }}
                      >
                        {c.endpoint}
                        {c.message ? ` → ${c.message}` : ''}
                      </code>

                      {c.fixHint ? (
                        <span
                          style={{
                            font: `400 11.5px/1.55 ${FONT}`,
                            color: 'var(--ink-3)',
                            textWrap: 'pretty',
                          }}
                        >
                          {c.fixHint}
                        </span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          {grouped.map(([group, list]) => (
            <div key={group} style={{ ...card, padding: '6px 16px 8px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '11px 0 9px',
                }}
              >
                <span style={{ flex: 1, font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                  {group}
                </span>
                <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                  {list.filter((c) => c.status === 'healthy').length} of {list.length} healthy
                </span>
              </div>
              {list.map((c) => {
                const t = toneStyle(STATUS_TONE[c.status])
                return (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
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
                        color: t.fg,
                      }}
                    >
                      <DcIcon
                        name={STATUS_ICON[c.status]}
                        size={13}
                        style={
                          c.status === 'checking'
                            ? { animation: 'dc-spin .8s linear infinite' }
                            : undefined
                        }
                      />
                    </span>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <span style={{ font: `500 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                        {c.name}
                      </span>
                      <span
                        style={{
                          font: `400 11px/1.35 ${MONO}`,
                          color: 'var(--ink-3)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.endpoint}
                      </span>
                    </span>
                    <span
                      style={{
                        flex: 'none',
                        font: `600 12px/1 ${MONO}`,
                        color: c.latencyMs != null ? 'var(--ink-2)' : 'var(--ink-3)',
                        width: 62,
                        textAlign: 'right',
                      }}
                    >
                      {c.latencyMs != null ? `${c.latencyMs}ms` : '—'}
                    </span>
                    <span
                      style={{
                        flex: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        height: 24,
                        padding: '0 9px',
                        borderRadius: 6,
                        font: `600 10.5px/1 ${FONT}`,
                        letterSpacing: '.05em',
                        textTransform: 'uppercase',
                        border: `1px solid ${t.bd}`,
                        background: t.bg,
                        color: t.fg,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span
                        style={{ width: 5, height: 5, borderRadius: 99, background: 'currentColor' }}
                      />
                      {c.status}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </>
      )}
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
  color?: string
}) {
  return (
    <div
      style={{ ...card, padding: '14px 15px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <span style={capsLabel}>{label}</span>
      <span
        style={{
          font: `700 25px/1 ${FONT}`,
          letterSpacing: '-.025em',
          color: color ?? 'var(--ink)',
          textTransform: 'capitalize',
        }}
      >
        {value}
      </span>
      <span style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
    </div>
  )
}
