'use client'

import type { ReactNode } from 'react'

import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

export const hubCard = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

export const hubCaps = {
  font: `600 11px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
}

export const hubTh = {
  textAlign: 'left' as const,
  padding: '9px 15px',
  font: `600 10.5px/1 ${FONT}`,
  letterSpacing: '.09em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap' as const,
}

type QueryLike = { error?: unknown; isError?: boolean; isLoading?: boolean; isFetching?: boolean; refetch: () => unknown }

const SKELETON: DcBlock[] = [
  { t: 'kpis' } as DcBlock,
  { t: 'table', w: 'main', title: '', cols: [], rows: [] } as DcBlock,
]

export function DcHubFrame({
  crumbGroup,
  title,
  queries,
  onBack,
  actions,
  children,
  empty,
  errorHint,
}: {
  crumbGroup: string
  title: string
  queries: QueryLike[]
  onBack?: () => void
  actions?: { label: string; icon: string; variant?: 'primary' | 'ghost'; onClick?: () => void }[]
  children: ReactNode
  empty?: boolean
  errorHint?: string
}) {
  const { api } = useAdminConnection(25_000)
  const status = dcPageStatus(queries, api.pulse)
  const loading = queries.some((q) => q.isLoading)
  const errored = queries.some((q) => q.error || q.isError)
  const syncing = queries.some((q) => q.isFetching)
  const firstError = queries.find((q) => q.error)?.error

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 48 }}>
      <DcPageHead
        crumbGroup={crumbGroup}
        title={title}
        statusLabel={status.label}
        statusTone={status.tone}
        syncLabel={syncing ? 'Refreshing…' : 'Synced'}
        syncing={syncing}
        onSync={() => {
          for (const q of queries) void q.refetch()
        }}
        {...(onBack ? { onBack } : {})}
        {...(actions ? { actions } : {})}
      />
      {loading && !errored ? <DcLoadingState blocks={SKELETON} /> : null}
      {errored ? (
        <DcErrorState
          error={
            firstError instanceof Error
              ? firstError.message
              : errorHint ?? `${title} unavailable`
          }
          {...(errorHint ? { hint: errorHint } : {})}
          onRetry={() => {
            for (const q of queries) void q.refetch()
          }}
        />
      ) : null}
      {!loading && !errored && empty ? (
        <DcEmptyState icon="icon-inbox" title={`No ${title.toLowerCase()} data`} body="Nothing to show yet from the API." />
      ) : null}
      {!loading && !errored && !empty ? children : null}
    </div>
  )
}

export function HubKpis({
  items,
}: {
  items: { label: string; value: string | number; tone?: DcTone }[]
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
      {items.map((item) => {
        const tone = toneStyle(item.tone ?? 'mute')
        return (
          <div key={item.label} style={{ ...hubCard, padding: '14px 16px' }}>
            <div style={hubCaps}>{item.label}</div>
            <div style={{ marginTop: 8, font: `600 22px/1.1 ${MONO}`, color: tone.fg }}>{item.value}</div>
          </div>
        )
      })}
    </div>
  )
}

export function HubTable({
  columns,
  rows,
}: {
  columns: string[]
  rows: (string | number | ReactNode)[][]
}) {
  return (
    <div style={{ ...hubCard, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', font: `400 13px/1.4 ${FONT}` }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} style={hubTh}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  style={{
                    padding: '10px 15px',
                    borderBottom: '1px solid var(--line)',
                    color: 'var(--ink)',
                    verticalAlign: 'top',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function HubTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {tabs.map((tab) => {
        const on = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`,
              borderRadius: 999,
              padding: '7px 14px',
              background: on ? 'var(--ink)' : 'transparent',
              color: on ? 'var(--surface)' : 'var(--ink-2)',
              font: `600 12px/1 ${FONT}`,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
