'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, formatTaka, toneStyle } from '@/components/dc/tokens'
import { toastFail, toastOk, toastWarn } from '@/lib/admin/feedback'
import {
  fetchFinanceOverview,
  updateFinanceSettings,
  type FinanceOverviewData,
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

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: 'this_month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
] as const

type PresetId = (typeof PRESETS)[number]['id']

const METRICS: Array<{
  key: keyof FinanceOverviewData['metrics']
  label: string
  hint: string
}> = [
  { key: 'grossSales', label: 'Gross sales', hint: 'Delivered order subtotals' },
  { key: 'netSales', label: 'Net sales', hint: 'Including delivery, after discount' },
  { key: 'cogs', label: 'COGS', hint: 'Product costPrice × qty — missing cost is not invented' },
  { key: 'packaging', label: 'Packaging', hint: 'Store default per delivered order' },
  { key: 'delivery', label: 'Delivery', hint: 'Real courier / order delivery charge' },
  { key: 'adSpend', label: 'Ad spend', hint: 'Approved advertising expenses' },
  { key: 'opEx', label: 'OpEx', hint: 'Salary, office, utilities, software…' },
  { key: 'paymentFees', label: 'Payment fees', hint: 'Digital fee % + fee expenses' },
  { key: 'grossProfit', label: 'Gross profit', hint: 'Sales − COGS − packaging' },
  { key: 'cashIn', label: 'Cash in', hint: 'Paid / non-COD collected' },
  { key: 'cashOut', label: 'Cash out', hint: 'Approved expenses + delivery + fees' },
  { key: 'receivableCod', label: 'Receivable (COD)', hint: 'COD not settled — best effort' },
  { key: 'returnLoss', label: 'Refund / return', hint: 'RMA refunds + return expenses' },
]

export function DcFinanceOverview() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="finance" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcFinanceOverviewBody />
    </DcScreenProvider>
  )
}

function DcFinanceOverviewBody() {
  const router = useRouter()
  const qc = useQueryClient()
  const { api } = useAdminConnection(25_000)
  const [preset, setPreset] = useState<PresetId>('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [packaging, setPackaging] = useState('')
  const [feePct, setFeePct] = useState('')

  const params = useMemo(() => {
    if (preset === 'custom') {
      return {
        preset: 'custom',
        ...(customFrom ? { from: customFrom } : {}),
        ...(customTo ? { to: customTo } : {}),
      }
    }
    return { preset }
  }, [preset, customFrom, customTo])

  const overview = useQuery({
    queryKey: ['finance-overview', params],
    queryFn: () => fetchFinanceOverview(params),
    staleTime: 30_000,
    retry: 1,
  })

  const saveSettings = useMutation({
    mutationFn: () =>
      updateFinanceSettings({
        ...(packaging !== '' ? { defaultPackagingCostPerOrder: Number(packaging) } : {}),
        ...(feePct !== '' ? { paymentFeePercent: Number(feePct) } : {}),
      }),
    onSuccess: async (saved) => {
      toastOk('Finance cost assumptions saved.')
      setPackaging(String(saved.defaultPackagingCostPerOrder))
      setFeePct(String(saved.paymentFeePercent))
      await qc.invalidateQueries({ queryKey: ['finance-overview'] })
    },
    onError: (err) => {
      toastFail(err instanceof Error ? err.message : 'Could not save finance settings.')
    },
  })

  const data = overview.data
  const m = data?.metrics
  const pageStatus = dcPageStatus([overview], api.pulse)

  const skeleton: DcBlock[] = [
    { t: 'seg' } as DcBlock,
    { t: 'hero' } as DcBlock,
    { t: 'kpis' } as DcBlock,
    { t: 'form' } as DcBlock,
  ]

  return (
    <>
      <DcPageHead
        crumbGroup="Finance"
        title="Profit & Cash Flow"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          overview.isFetching
            ? 'syncing…'
            : data?.period
              ? `${fmtDate(data.period.from)} → ${fmtDate(data.period.to)}`
              : 'no period'
        }
        syncing={overview.isFetching}
        actions={[
          {
            label: 'Order profit',
            icon: 'icon-calculator',
            variant: 'ghost',
            onClick: () => router.push('/dashboard/finance/order-profit'),
          },
          {
            label: 'Expenses',
            icon: 'icon-receipt',
            variant: 'ghost',
            onClick: () => router.push('/dashboard/finance/expenses'),
          },
        ]}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {PRESETS.map((p) => {
          const active = preset === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              style={{
                border: `1px solid ${active ? 'var(--ink)' : 'var(--line)'}`,
                background: active ? 'var(--ink)' : 'var(--surface)',
                color: active ? 'var(--paper)' : 'var(--ink-2)',
                borderRadius: 999,
                padding: '8px 12px',
                font: `600 12px/1 ${FONT}`,
                cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {preset === 'custom' ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <label style={{ display: 'grid', gap: 4, font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>
            From
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="admin-input"
            />
          </label>
          <label style={{ display: 'grid', gap: 4, font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>
            To
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="admin-input"
            />
          </label>
        </div>
      ) : null}

      {overview.error ? (
        <DcErrorState
          error={`GET /admin/finance/overview → ${overview.error instanceof Error ? overview.error.message : 'failed'}`}
          hint="API offline or finance module failed — numbers are not invented."
          onRetry={() => void overview.refetch()}
        />
      ) : overview.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : !m ? (
        <DcEmptyState
          icon="icon-banknote"
          title="No finance window yet"
          body="Delivered orders and approved expenses in this range will appear here."
        />
      ) : (
        <>
          {m.incompleteOrders > 0 ? (
            <div
              style={{
                ...card,
                padding: '12px 14px',
                marginBottom: 14,
                borderColor: 'var(--warn-bd)',
                background: 'var(--warn-soft)',
              }}
            >
              <strong style={{ font: `600 13px/1.4 ${FONT}`, color: 'var(--warn)' }}>
                {m.incompleteOrders} order{m.incompleteOrders === 1 ? '' : 's'} incomplete
              </strong>
              <p style={{ margin: '6px 0 0', font: `500 12.5px/1.45 ${FONT}`, color: 'var(--ink-2)' }}>
                Missing product costPrice is counted as ৳0 — not selling price. Set cost on products
                and packaging default below.
              </p>
            </div>
          ) : null}

          <div style={{ ...card, padding: '22px 22px 18px', marginBottom: 16 }}>
            <div style={capsLabel}>Net profit · {data?.formula}</div>
            <div
              style={{
                marginTop: 10,
                font: `700 42px/1 ${FONT}`,
                letterSpacing: '-.04em',
                color: m.netProfit >= 0 ? 'var(--ok)' : 'var(--bad)',
              }}
            >
              {formatTaka(m.netProfit)}
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ font: `600 13px/1 ${FONT}`, color: 'var(--ink-2)' }}>
                Margin {m.marginPct == null ? '—' : `${m.marginPct}%`}
              </span>
              <ChangePill pct={m.netProfitChangePct} />
              <span style={{ font: `500 12.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                {m.orderCount} delivered order{m.orderCount === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}
          >
            {METRICS.map((row) => {
              const value = Number(m[row.key] ?? 0)
              return (
                <div key={row.key} style={{ ...card, padding: '14px 15px' }}>
                  <div style={capsLabel}>{row.label}</div>
                  <div style={{ marginTop: 8, font: `700 20px/1 ${MONO}`, color: 'var(--ink)' }}>
                    {formatTaka(value)}
                  </div>
                  <div style={{ marginTop: 6, font: `500 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>
                    {row.hint}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ ...card, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>Cost assumptions</div>
            <p style={{ margin: '6px 0 12px', font: `500 12.5px/1.45 ${FONT}`, color: 'var(--ink-2)' }}>
              Packaging default is ৳0 until you set it — never a silent ৳15. Digital payment fee applies
              to non-COD only.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
              <label style={{ display: 'grid', gap: 4, font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                Packaging / order (৳)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="admin-input"
                  placeholder={String(data?.settings.defaultPackagingCostPerOrder ?? 0)}
                  value={packaging}
                  onChange={(e) => setPackaging(e.target.value)}
                />
              </label>
              <label style={{ display: 'grid', gap: 4, font: `600 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                Payment fee %
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="admin-input"
                  placeholder={String(data?.settings.paymentFeePercent ?? 0)}
                  value={feePct}
                  onChange={(e) => setFeePct(e.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={saveSettings.isPending || (packaging === '' && feePct === '')}
                onClick={() => {
                  if (packaging !== '' && (!Number.isFinite(Number(packaging)) || Number(packaging) < 0)) {
                    toastFail('Packaging must be 0 or more.')
                    return
                  }
                  if (feePct !== '' && (!Number.isFinite(Number(feePct)) || Number(feePct) < 0)) {
                    toastFail('Fee percent must be 0 or more.')
                    return
                  }
                  saveSettings.mutate()
                }}
                style={{
                  border: 0,
                  borderRadius: 10,
                  padding: '10px 14px',
                  background: 'var(--ink)',
                  color: 'var(--paper)',
                  font: `600 12.5px/1 ${FONT}`,
                  cursor: 'pointer',
                }}
              >
                {saveSettings.isPending ? 'Saving…' : 'Save assumptions'}
              </button>
            </div>
            <p style={{ margin: '12px 0 0', font: `500 12px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
              {data?.adAllocationNote}
            </p>
          </div>

          <div style={{ ...card, padding: '16px 18px' }}>
            <div style={{ font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>Coming next</div>
            <p style={{ margin: '6px 0 10px', font: `500 12.5px/1.45 ${FONT}`, color: 'var(--ink-2)' }}>
              Not fake numbers — these modules are not in V1.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(data?.comingNext ?? []).map((label) => (
                <span
                  key={label}
                  style={{
                    ...toneStyle('mute'),
                    border: '1px solid var(--line)',
                    borderRadius: 999,
                    padding: '6px 10px',
                    font: `600 11.5px/1 ${FONT}`,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => toastWarn('Cash flow ledger, ads sync, and loss intelligence ship in later phases.')}
              style={{
                marginTop: 12,
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                font: `600 12px/1 ${FONT}`,
                color: 'var(--violet)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <DcIcon name="icon-info" size={13} /> Why some tiles are missing
            </button>
          </div>
        </>
      )}
    </>
  )
}

function ChangePill({ pct }: { pct: number | null }) {
  if (pct == null) {
    return <span style={{ font: `600 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>vs prior window — n/a</span>
  }
  const up = pct >= 0
  return (
    <span
      style={{
        font: `600 12px/1 ${FONT}`,
        color: up ? 'var(--ok)' : 'var(--bad)',
      }}
    >
      {up ? '+' : ''}
      {pct}% vs prior window
    </span>
  )
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })
}
