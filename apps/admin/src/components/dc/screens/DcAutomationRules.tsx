'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcEmptyState, DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { DcIcon } from '@/components/dc/DcIcon'
import { DcModal } from '@/components/dc/DcModal'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { dcPageStatus } from '@/components/dc/page-status'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { FONT, MONO, toneStyle, type DcTone } from '@/components/dc/tokens'
import { toastApiSaved, toastFail } from '@/lib/admin/feedback'
import {
  createAutomationRule,
  deleteAutomationRule,
  fetchAutomationLogs,
  fetchAutomationStats,
  toggleAutomationRule,
  type ApiAutomationRule,
  type AutomationLog,
} from '@/lib/api/automation'
import { useAutomationRules } from '@/lib/api/hooks'
import { verifyBooleanEquals, verifyPersisted, verifyStringEquals } from '@/lib/admin/mutation-verify'
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

const TRIGGERS = [
  'ORDER_PLACED',
  'ORDER_CONFIRMED',
  'ORDER_DELIVERED',
  'ORDER_CANCELLED',
  'PAYMENT_FAILED',
  'COURIER_FAILED',
  'STOCK_LOW',
  'ABANDONED_CART',
  'CUSTOMER_SIGNUP',
  'CUSTOMER_BIRTHDAY',
  'REVIEW_POSTED',
  'RETURN_REQUESTED',
  'COUPON_EXPIRED',
] as const

const ACTIONS = [
  { value: 'SEND_SMS', label: 'Send SMS', hint: 'Uses connected SMS provider' },
  { value: 'SEND_EMAIL', label: 'Send Email', hint: 'Sends via store SMTP / Gmail' },
  { value: 'SEND_TELEGRAM', label: 'Send Telegram', hint: 'Notifies linked admin channel' },
  { value: 'BOOK_COURIER', label: 'Book Courier', hint: 'Dispatches parcel to courier' },
  { value: 'NOTIFY_ADMIN', label: 'Notify Admin', hint: 'Creates in-app notification' },
  { value: 'UPDATE_ORDER_STATUS', label: 'Update Order Status', hint: 'Transitions order status' },
  { value: 'APPLY_TAG', label: 'Apply Customer Tag', hint: 'Tags customer profile' },
  { value: 'REMOVE_TAG', label: 'Remove Customer Tag', hint: 'Removes customer tag' },
  { value: 'REQUIRE_ADVANCE_PAYMENT', label: 'Require Advance Payment', hint: 'Flags order for COD risk' },
  { value: 'HIDE_PRODUCT', label: 'Hide Product', hint: 'Unpublishes low-stock product' },
  { value: 'ADD_LOYALTY_POINTS', label: 'Add Loyalty Points', hint: 'Credits loyalty balance' },
  { value: 'CUSTOM_WEBHOOK', label: 'Custom Webhook', hint: 'Posts payload to external URL' },
] as const

const OPERATORS = [
  { value: 'EQUALS', label: 'Equals (==)' },
  { value: 'NOT_EQUALS', label: 'Not equals (!=)' },
  { value: 'GREATER_THAN', label: 'Greater than (>)' },
  { value: 'LESS_THAN', label: 'Less than (<)' },
  { value: 'CONTAINS', label: 'Contains text' },
  { value: 'NOT_CONTAINS', label: 'Does not contain' },
  { value: 'IN', label: 'In list (comma separated)' },
  { value: 'NOT_IN', label: 'Not in list' },
] as const

const TRIGGER_FIELDS: Record<string, Array<{ value: string; label: string }>> = {
  ORDER_PLACED: [
    { value: 'total', label: 'Order Total (BDT)' },
    { value: 'city', label: 'Shipping City / District' },
    { value: 'paymentMethod', label: 'Payment Method (COD, BKASH, etc.)' },
    { value: 'isCodRisk', label: 'Is COD Risk (true/false)' },
    { value: 'customerName', label: 'Customer Name' },
    { value: 'email', label: 'Customer Email' },
    { value: 'phone', label: 'Customer Phone' },
  ],
  ORDER_CONFIRMED: [
    { value: 'total', label: 'Order Total (BDT)' },
    { value: 'city', label: 'Shipping City / District' },
    { value: 'paymentMethod', label: 'Payment Method' },
    { value: 'isCodRisk', label: 'Is COD Risk (true/false)' },
  ],
  ORDER_DELIVERED: [
    { value: 'total', label: 'Order Total (BDT)' },
    { value: 'city', label: 'Shipping City / District' },
  ],
  ORDER_CANCELLED: [
    { value: 'total', label: 'Order Total (BDT)' },
    { value: 'city', label: 'Shipping City / District' },
    { value: 'paymentMethod', label: 'Payment Method' },
  ],
  PAYMENT_FAILED: [
    { value: 'total', label: 'Order Total (BDT)' },
    { value: 'paymentMethod', label: 'Payment Method' },
  ],
  STOCK_LOW: [
    { value: 'stock', label: 'Current Stock Quantity' },
    { value: 'threshold', label: 'Product Low Stock Threshold' },
    { value: 'productName', label: 'Product Name' },
    { value: 'sku', label: 'Variant SKU' },
  ],
  ABANDONED_CART: [
    { value: 'total', label: 'Cart Total (BDT)' },
    { value: 'itemCount', label: 'Total Item Count' },
    { value: 'customerName', label: 'Customer Name' },
    { value: 'email', label: 'Customer Email' },
    { value: 'phone', label: 'Customer Phone' },
  ],
  CUSTOMER_SIGNUP: [
    { value: 'customerName', label: 'Customer Name' },
    { value: 'email', label: 'Customer Email' },
    { value: 'phone', label: 'Customer Phone' },
  ],
}

export type DraftCondition = {
  field: string
  operator: string
  value: string
}

export type DraftAction = {
  action: string
  params: Record<string, unknown>
  sortOrder: number
}

const TRIGGER_LABELS: Record<string, string> = {
  ORDER_PLACED: 'Order placed',
  ORDER_CONFIRMED: 'Order confirmed',
  ORDER_DELIVERED: 'Order delivered',
  ORDER_CANCELLED: 'Order cancelled',
  PAYMENT_FAILED: 'Payment failed',
  COURIER_FAILED: 'Courier failed',
  STOCK_LOW: 'Stock low',
  ABANDONED_CART: 'Abandoned cart',
  CUSTOMER_SIGNUP: 'Customer signup',
  CUSTOMER_BIRTHDAY: 'Customer birthday',
  REVIEW_POSTED: 'Review posted',
  RETURN_REQUESTED: 'Return requested',
  COUPON_EXPIRED: 'Coupon expired',
  CUSTOM: 'Custom trigger',
}

function actionLabel(value?: string) {
  return ACTIONS.find((item) => item.value === value)?.label ?? value?.replace(/_/g, ' ') ?? 'No action'
}

function operatorSymbol(op?: string) {
  switch (op) {
    case 'EQUALS': return '=='
    case 'NOT_EQUALS': return '!='
    case 'GREATER_THAN': return '>'
    case 'LESS_THAN': return '<'
    case 'CONTAINS': return 'contains'
    case 'NOT_CONTAINS': return '!contains'
    case 'IN': return 'in'
    case 'NOT_IN': return '!in'
    default: return op ?? '=='
  }
}

function stableTime(value: string | null) {
  if (!value) return 'Never'
  if (!value.includes('T')) return value
  return `${value.replace('T', ' ').slice(0, 16)} UTC`
}

export function DcAutomationRules() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="automation" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcAutomationRulesBody />
    </DcScreenProvider>
  )
}

function DcAutomationRulesBody() {
  const qc = useQueryClient()
  const rules = useAutomationRules()
  const stats = useQuery({
    queryKey: ['automation-stats'],
    queryFn: fetchAutomationStats,
    staleTime: 20_000,
    retry: 1,
  })
  const logs = useQuery({
    queryKey: ['automation-logs', 20],
    queryFn: () => fetchAutomationLogs(20),
    staleTime: 20_000,
    retry: 1,
  })
  const { api } = useAdminConnection(25_000)

  const [createOpen, setCreateOpen] = useState(false)
  const [deleting, setDeleting] = useState<ApiAutomationRule | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const initialForm = {
    name: '',
    description: '',
    trigger: 'ORDER_PLACED',
    conditions: [] as DraftCondition[],
    actions: [
      {
        action: 'SEND_SMS',
        params: { message: 'SPLARO: Your order update from automation.' },
        sortOrder: 0,
      },
    ] as DraftAction[],
  }

  const [form, setForm] = useState(initialForm)

  const rows = useMemo(() => rules.data ?? [], [rules.data])
  const active = rows.filter((row) => row.isActive).length
  const pageStatus = dcPageStatus([rules, stats, logs], api.pulse)
  const syncing = rules.isFetching || stats.isFetching || logs.isFetching
  const ruleGroups = useMemo(() => {
    const commerce = rows.filter((row) =>
      /ORDER|PAYMENT|COURIER|RETURN/.test(row.trigger),
    )
    const growth = rows.filter((row) => !commerce.includes(row))
    return [
      { title: 'Order and courier rules', rows: commerce },
      { title: 'Catalog and customer rules', rows: growth },
    ].filter((group) => group.rows.length > 0)
  }, [rows])

  const refresh = () => {
    void rules.refetch()
    void stats.refetch()
    void logs.refetch()
  }

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['automation-rules'] }),
      qc.invalidateQueries({ queryKey: ['automation-stats'] }),
      qc.invalidateQueries({ queryKey: ['automation-logs'] }),
    ])
  }

  const handleToggle = async (row: ApiAutomationRule) => {
    const next = !row.isActive
    setBusyId(row.id)
    try {
      const saved = await toggleAutomationRule(row.id, next)
      if (!verifyBooleanEquals(saved.isActive, next, 'Automation rule state')) return
      toastApiSaved(next ? 'Rule activated' : 'Rule paused')
      await invalidate()
    } catch (error) {
      toastFail(error instanceof Error ? error.message : 'Could not update automation rule')
    } finally {
      setBusyId(null)
    }
  }

  const handleCreate = async () => {
    const name = form.name.trim()
    if (!name) {
      toastFail('Rule name is required')
      return
    }

    if (form.actions.length === 0) {
      toastFail('At least one action is required')
      return
    }

    // Validate actions
    for (let i = 0; i < form.actions.length; i += 1) {
      const act = form.actions[i]
      if (!act) continue
      if (act.action === 'SEND_SMS' || act.action === 'SEND_TELEGRAM') {
        const msg = String(act.params['message'] ?? '').trim()
        if (!msg) {
          toastFail(`Action ${i + 1} (${actionLabel(act.action)}): Message is required`)
          return
        }
      }
      if (act.action === 'SEND_EMAIL') {
        const subj = String(act.params['subject'] ?? '').trim()
        if (!subj) {
          toastFail(`Action ${i + 1} (Send Email): Subject is required`)
          return
        }
      }
      if (act.action === 'CUSTOM_WEBHOOK') {
        const url = String(act.params['url'] ?? '').trim()
        if (!url || !url.startsWith('http')) {
          toastFail(`Action ${i + 1} (Custom Webhook): Valid HTTP URL is required`)
          return
        }
      }
    }

    // Validate conditions
    for (let i = 0; i < form.conditions.length; i += 1) {
      const cond = form.conditions[i]
      if (!cond || !cond.field.trim() || !cond.value.trim()) {
        toastFail(`Condition ${i + 1} requires both a field and a comparison value`)
        return
      }
    }

    setSaving(true)
    try {
      const formattedActions = form.actions.map((act, idx) => ({
        action: act.action,
        params: act.params,
        sortOrder: idx,
      }))

      const desc = form.description.trim()
      const saved = await createAutomationRule({
        name,
        ...(desc ? { description: desc } : {}),
        trigger: form.trigger,
        conditions: form.conditions.map((c) => ({
          field: c.field.trim(),
          operator: c.operator,
          value: c.value.trim(),
        })),
        actions: formattedActions,
      })
      if (!verifyStringEquals(saved.name, name, 'Automation rule name')) return
      if (!verifyStringEquals(saved.trigger, form.trigger, 'Automation trigger')) return
      if (!verifyBooleanEquals(saved.isActive, true, 'Automation rule active state')) return
      if (!verifyPersisted(Boolean(saved.id && saved.actions?.length), 'Automation rule action did not persist')) return
      toastApiSaved('Automation rule created')
      setCreateOpen(false)
      setForm(initialForm)
      await invalidate()
    } catch (error) {
      toastFail(error instanceof Error ? error.message : 'Could not create automation rule')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setBusyId(deleting.id)
    try {
      const result = await deleteAutomationRule(deleting.id)
      if (!verifyPersisted(result.deleted === deleting.id, 'Automation rule delete did not persist')) return
      toastApiSaved('Automation rule deleted')
      setDeleting(null)
      await invalidate()
    } catch (error) {
      toastFail(error instanceof Error ? error.message : 'Could not delete automation rule')
    } finally {
      setBusyId(null)
    }
  }

  const skeleton: DcBlock[] = [
    { t: 'kpis' } as DcBlock,
    { t: 'toggles', w: 'main' } as DcBlock,
    { t: 'timeline', w: 'side' } as DcBlock,
  ]

  return (
    <>
      <DcPageHead
        crumbGroup="Intelligence"
        title="Automation Rules"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={syncing ? 'reading worker…' : `${active} active · ${rows.length} defined`}
        syncing={syncing}
        onSync={refresh}
        actions={[
          {
            label: 'New rule',
            icon: 'icon-plus',
            variant: 'primary',
            onClick: () => setCreateOpen(true),
          },
        ]}
      />

      {rules.isLoading || stats.isLoading || logs.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : rules.error ? (
        <DcErrorState
          error={`GET /automation/rules → ${rules.error instanceof Error ? rules.error.message : 'Request failed'}`}
          hint="No rule state changed. Restore API connection, then retry."
          onRetry={refresh}
        />
      ) : rows.length === 0 ? (
        <DcEmptyState
          icon="icon-workflow"
          title="No automation rules yet"
          body="Rules fire on order, stock and payment events — send an SMS on delivery, flag a COD risk, notify Telegram. Create your first rule to start automating."
        />
      ) : (
        <>
          <AutomationKpis
            active={active}
            total={rows.length}
            runs={stats.data?.totalRuns ?? rows.reduce((sum, row) => sum + row.runCount, 0)}
            actions={stats.data?.successCount ?? null}
            failures={stats.data?.failCount ?? null}
            successRate={stats.data?.successRate ?? null}
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
            <section style={{ flex: '2 1 620px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {rows.length === 0 ? (
                <EmptyRules onCreate={() => setCreateOpen(true)} />
              ) : (
                ruleGroups.map((group) => (
                  <RuleGroup
                    key={group.title}
                    title={group.title}
                    rows={group.rows}
                    busyId={busyId}
                    onToggle={handleToggle}
                    onDelete={setDeleting}
                  />
                ))
              )}
            </section>
            <RuleLog rows={logs.data?.items ?? []} error={logs.error} onRetry={() => void logs.refetch()} />
          </div>
        </>
      )}

      <CreateRuleModal
        open={createOpen}
        busy={saving}
        form={form}
        onChange={setForm}
        onClose={() => setCreateOpen(false)}
        onConfirm={() => void handleCreate()}
      />

      <DcModal
        open={Boolean(deleting)}
        title="Delete automation rule?"
        subtitle={deleting ? `${deleting.name} will stop permanently. Existing run logs remain auditable.` : undefined}
        confirmLabel="Delete rule"
        danger
        busy={busyId === deleting?.id}
        onClose={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      >
        <p style={{ margin: 0, font: `400 12px/1.5 ${FONT}`, color: 'var(--ink-2)' }}>
          Delete cannot be undone. Pause rule instead if you may need it later.
        </p>
      </DcModal>
    </>
  )
}

function AutomationKpis({
  active,
  total,
  runs,
  actions,
  failures,
  successRate,
}: {
  active: number
  total: number
  runs: number
  actions: number | null
  failures: number | null
  successRate: number | null
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: 12 }}>
      <Kpi label="Rules active" value={String(active)} sub={`of ${total} defined`} tone="vio" />
      <Kpi label="Total runs" value={String(runs)} sub="worker execution log" tone="info" />
      <Kpi
        label="Actions completed"
        value={actions == null ? '—' : String(actions)}
        sub={successRate == null ? 'stats unavailable' : `${successRate}% success rate`}
        tone={actions == null ? 'mute' : 'ok'}
      />
      <Kpi
        label="Failures recorded"
        value={failures == null ? '—' : String(failures)}
        sub={failures == null ? 'stats unavailable' : 'all retained in log'}
        tone={failures == null ? 'mute' : failures ? 'warn' : 'ok'}
      />
    </div>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: DcTone }) {
  const colors = toneStyle(tone)
  return (
    <div style={{ ...card, minHeight: 100, padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={capsLabel}>{label}</span>
      <strong style={{ font: `700 24px/1 ${FONT}`, color: 'var(--ink)' }}>{value}</strong>
      <span style={{ font: `400 11px/1.3 ${FONT}`, color: colors.fg }}>{sub}</span>
    </div>
  )
}

function RuleGroup({
  title,
  rows,
  busyId,
  onToggle,
  onDelete,
}: {
  title: string
  rows: ApiAutomationRule[]
  busyId: string | null
  onToggle: (row: ApiAutomationRule) => Promise<void>
  onDelete: (row: ApiAutomationRule) => void
}) {
  return (
    <section style={{ ...card, overflow: 'hidden' }}>
      <div
        style={{
          minHeight: 50,
          padding: '0 14px',
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <span style={{ flex: 1, font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>{title}</span>
        <span style={{ font: `500 10.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>{rows.length} rules</span>
      </div>
      <div style={{ padding: '3px 14px' }}>
        {rows.map((row, index) => {
          const actionSummary = row.actions?.length
            ? row.actions.map((a) => actionLabel(a.action)).join(' ➔ ')
            : 'No actions'
          const conditionSummary = row.conditions?.length
            ? row.conditions.map((c) => `${c.field} ${operatorSymbol(c.operator)} "${c.value}"`).join(' AND ')
            : 'Every matching event'

          return (
            <div
              key={row.id}
              style={{
                minHeight: 72,
                padding: '10px 0',
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 11,
                borderBottom: index === rows.length - 1 ? 0 : '1px solid var(--line)',
                opacity: row.isActive ? 1 : 0.65,
              }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  display: 'grid',
                  placeItems: 'center',
                  border: '1px solid var(--violet-bd)',
                  borderRadius: 9,
                  background: 'var(--violet-soft)',
                  color: 'var(--violet)',
                }}
              >
                <DcIcon name="icon-zap" size={14} />
              </span>
              <span style={{ flex: '1 1 250px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ font: `600 12px/1.2 ${FONT}`, color: 'var(--ink)' }}>{row.name}</strong>
                  {row.conditions?.length ? (
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: 'var(--surface-3)',
                        font: `500 9.5px/1.3 ${MONO}`,
                        color: 'var(--ink-2)',
                      }}
                    >
                      {row.conditions.length} condition{row.conditions.length > 1 ? 's' : ''}
                    </span>
                  ) : null}
                  {row.actions?.length > 1 ? (
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: 'var(--violet-soft)',
                        font: `500 9.5px/1.3 ${MONO}`,
                        color: 'var(--violet)',
                      }}
                    >
                      {row.actions.length} steps
                    </span>
                  ) : null}
                </div>
                <span style={{ font: `400 10.5px/1.35 ${FONT}`, color: 'var(--ink-2)' }}>
                  <strong style={{ color: 'var(--ink)' }}>WHEN</strong> {TRIGGER_LABELS[row.trigger] ?? row.trigger}
                  {' · '}
                  <strong style={{ color: 'var(--ink)' }}>IF</strong> {conditionSummary}
                  {' · '}
                  <strong style={{ color: 'var(--ink)' }}>THEN</strong> {actionSummary}
                </span>
                <span style={{ font: `400 10px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                  {row.runCount} runs · last {stableTime(row.lastRunAt)}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={row.isActive}
                aria-label={`${row.isActive ? 'Pause' : 'Activate'} ${row.name}`}
                disabled={busyId !== null}
                onClick={() => void onToggle(row)}
                style={{
                  width: 38,
                  height: 22,
                  padding: 2,
                  border: `1px solid ${row.isActive ? 'var(--ok-bd)' : 'var(--line-2)'}`,
                  borderRadius: 99,
                  background: row.isActive ? 'var(--ok-soft)' : 'var(--surface-3)',
                  cursor: busyId ? 'wait' : 'pointer',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: 16,
                    height: 16,
                    borderRadius: 99,
                    background: row.isActive ? 'var(--ok)' : 'var(--ink-3)',
                    transform: row.isActive ? 'translateX(16px)' : 'translateX(0)',
                    transition: 'transform .16s ease',
                  }}
                />
              </button>
              <button
                type="button"
                aria-label={`Delete ${row.name}`}
                disabled={busyId !== null}
                onClick={() => onDelete(row)}
                style={{
                  width: 30,
                  height: 30,
                  display: 'grid',
                  placeItems: 'center',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  background: 'var(--surface-2)',
                  color: 'var(--ink-3)',
                  cursor: busyId ? 'not-allowed' : 'pointer',
                }}
              >
                <DcIcon name="icon-trash-2" size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function RuleLog({
  rows,
  error,
  onRetry,
}: {
  rows: AutomationLog[]
  error: unknown
  onRetry: () => void
}) {
  return (
    <section style={{ ...card, flex: '1 1 300px', minWidth: 0, overflow: 'hidden' }}>
      <div style={{ minHeight: 50, padding: '0 14px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--line)' }}>
        <span style={{ flex: 1, font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>Rule log</span>
        <span style={{ font: `500 10.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>{rows.length} recent</span>
      </div>
      {error ? (
        <div style={{ padding: 14 }}>
          <DcErrorState
            error={`GET /automation/logs → ${error instanceof Error ? error.message : 'Request failed'}`}
            hint="Rules remain unchanged."
            onRetry={onRetry}
          />
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding: '34px 18px', textAlign: 'center' }}>
          <DcIcon name="icon-clock" size={20} color="var(--ink-3)" />
          <p style={{ margin: '9px 0 0', font: `400 11.5px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
            No rule has executed yet. Live runs appear here.
          </p>
        </div>
      ) : (
        <div style={{ padding: '4px 14px' }}>
          {rows.slice(0, 12).map((row, index) => {
            const colors = toneStyle(row.success ? 'ok' : 'bad')
            return (
              <div
                key={row.id}
                style={{
                  minHeight: 62,
                  padding: '10px 0',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 9,
                  borderBottom: index === Math.min(rows.length, 12) - 1 ? 0 : '1px solid var(--line)',
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    display: 'grid',
                    placeItems: 'center',
                    border: `1px solid ${colors.bd}`,
                    borderRadius: 7,
                    background: colors.bg,
                    color: colors.fg,
                  }}
                >
                  <DcIcon name={row.success ? 'icon-check' : 'icon-triangle-alert'} size={12} />
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <strong style={{ font: `600 11px/1.2 ${FONT}`, color: 'var(--ink)' }}>{row.rule.name}</strong>
                  <span style={{ font: `400 10px/1.3 ${FONT}`, color: row.success ? 'var(--ink-3)' : 'var(--bad)' }}>
                    {row.success ? `${TRIGGER_LABELS[row.rule.trigger] ?? row.rule.trigger} completed` : row.errorMsg ?? 'Action failed'}
                  </span>
                </span>
                <span style={{ font: `500 9.5px/1.2 ${MONO}`, color: 'var(--ink-3)' }}>{stableTime(row.createdAt)}</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function EmptyRules({ onCreate }: { onCreate: () => void }) {
  return (
    <section style={{ ...card, padding: '52px 20px', textAlign: 'center' }}>
      <DcIcon name="icon-zap" size={24} color="var(--violet)" />
      <h2 style={{ margin: '12px 0 7px', font: `600 15px/1 ${FONT}`, color: 'var(--ink)' }}>No rules defined</h2>
      <p style={{ margin: '0 auto 15px', maxWidth: 380, font: `400 12px/1.55 ${FONT}`, color: 'var(--ink-3)' }}>
        Create trigger-to-action rule. Server stores state and logs every run.
      </p>
      <button
        type="button"
        onClick={onCreate}
        style={{
          height: 34,
          padding: '0 14px',
          border: '1px solid var(--violet-solid)',
          borderRadius: 9,
          background: 'var(--violet-solid)',
          color: 'var(--on-violet)',
          cursor: 'pointer',
          font: `600 12px/1 ${FONT}`,
        }}
      >
        New rule
      </button>
    </section>
  )
}

function CreateRuleModal({
  open,
  busy,
  form,
  onChange,
  onClose,
  onConfirm,
}: {
  open: boolean
  busy: boolean
  form: {
    name: string
    description: string
    trigger: string
    conditions: DraftCondition[]
    actions: DraftAction[]
  }
  onChange: (next: {
    name: string
    description: string
    trigger: string
    conditions: DraftCondition[]
    actions: DraftAction[]
  }) => void
  onClose: () => void
  onConfirm: () => void
}) {
  const inputStyle = {
    width: '100%',
    minHeight: 34,
    padding: '7px 10px',
    border: '1px solid var(--line)',
    borderRadius: 8,
    outline: 0,
    background: 'var(--surface-2)',
    color: 'var(--ink)',
    font: `400 12px/1.4 ${FONT}`,
    boxSizing: 'border-box' as const,
  }

  const fieldsForTrigger = TRIGGER_FIELDS[form.trigger] ?? [
    { value: 'total', label: 'Order Total' },
    { value: 'city', label: 'City / District' },
    { value: 'customerName', label: 'Customer Name' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
  ]

  const addCondition = () => {
    const defaultField = fieldsForTrigger[0]?.value ?? 'total'
    onChange({
      ...form,
      conditions: [...form.conditions, { field: defaultField, operator: 'GREATER_THAN', value: '' }],
    })
  }

  const updateCondition = (index: number, patch: Partial<DraftCondition>) => {
    const next = [...form.conditions]
    const item = next[index]
    if (!item) return
    next[index] = { ...item, ...patch }
    onChange({ ...form, conditions: next })
  }

  const removeCondition = (index: number) => {
    onChange({ ...form, conditions: form.conditions.filter((_, i) => i !== index) })
  }

  const addAction = () => {
    onChange({
      ...form,
      actions: [
        ...form.actions,
        {
          action: 'NOTIFY_ADMIN',
          params: { subject: 'Automated alert', message: 'SPLARO automation triggered.' },
          sortOrder: form.actions.length,
        },
      ],
    })
  }

  const updateAction = (index: number, actionType: string) => {
    const next = [...form.actions]
    let defaultParams: Record<string, unknown> = {}
    if (actionType === 'SEND_SMS' || actionType === 'SEND_TELEGRAM') {
      defaultParams = { message: 'SPLARO: Update on your request.' }
    } else if (actionType === 'SEND_EMAIL') {
      defaultParams = { subject: 'Order Update from SPLARO', message: 'Thank you for your order with SPLARO.' }
    } else if (actionType === 'BOOK_COURIER') {
      defaultParams = { provider: 'STEADFAST' }
    } else if (actionType === 'UPDATE_ORDER_STATUS') {
      defaultParams = { status: 'CONFIRMED' }
    } else if (actionType === 'APPLY_TAG' || actionType === 'REMOVE_TAG') {
      defaultParams = { tag: 'VIP' }
    } else if (actionType === 'ADD_LOYALTY_POINTS') {
      defaultParams = { points: 50 }
    } else if (actionType === 'CUSTOM_WEBHOOK') {
      defaultParams = { url: 'https://example.com/webhook' }
    } else {
      defaultParams = { subject: 'Rule triggered', message: 'Automation notification' }
    }

    next[index] = { action: actionType, params: defaultParams, sortOrder: index }
    onChange({ ...form, actions: next })
  }

  const updateActionParam = (index: number, paramKey: string, val: unknown) => {
    const next = [...form.actions]
    const current = next[index]
    if (!current) return
    next[index] = {
      ...current,
      params: { ...current.params, [paramKey]: val },
    }
    onChange({ ...form, actions: next })
  }

  const moveAction = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= form.actions.length) return
    const next = [...form.actions]
    const temp = next[index]!
    next[index] = next[target]!
    next[target] = temp
    onChange({ ...form, actions: next.map((a, i) => ({ ...a, sortOrder: i })) })
  }

  const removeAction = (index: number) => {
    if (form.actions.length <= 1) {
      toastFail('At least one action is required')
      return
    }
    onChange({
      ...form,
      actions: form.actions.filter((_, i) => i !== index).map((a, i) => ({ ...a, sortOrder: i })),
    })
  }

  return (
    <DcModal
      open={open}
      title="Create automation rule"
      subtitle="Define conditions and multiple actions. Verified before save."
      confirmLabel="Create rule"
      busy={busy}
      onClose={onClose}
      onConfirm={onConfirm}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '68vh', overflowY: 'auto', paddingRight: 4 }}>
        {/* Rule basic info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={capsLabel}>Rule Name *</span>
            <input
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              placeholder="e.g. VIP Order Courier & Email"
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={capsLabel}>When Event Fires (Trigger)</span>
            <select
              value={form.trigger}
              onChange={(event) => onChange({ ...form, trigger: event.target.value })}
              style={inputStyle}
            >
              {TRIGGERS.map((trigger) => (
                <option key={trigger} value={trigger}>{TRIGGER_LABELS[trigger]}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Live readable summary banner */}
        <div
          style={{
            padding: '10px 12px',
            border: '1px solid var(--violet-bd)',
            borderRadius: 9,
            background: 'var(--violet-soft)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <span style={{ ...capsLabel, color: 'var(--violet)' }}>Rule flow preview</span>
          <div style={{ font: `500 11.5px/1.45 ${FONT}`, color: 'var(--ink)' }}>
            <strong>WHEN</strong> {TRIGGER_LABELS[form.trigger] ?? form.trigger}{' '}
            <strong>IF</strong>{' '}
            {form.conditions.length
              ? form.conditions
                  .map((c) => `${c.field || 'field'} ${operatorSymbol(c.operator)} "${c.value || '?'}"`)
                  .join(' AND ')
              : 'all events match'}{' '}
            <strong>THEN</strong>{' '}
            {form.actions.length
              ? form.actions.map((a, i) => `${i + 1}. ${actionLabel(a.action)}`).join(' ➔ ')
              : 'No action'}
          </div>
        </div>

        {/* Conditions Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={capsLabel}>Conditions (All must match)</span>
            <button
              type="button"
              onClick={addCondition}
              style={{
                border: '1px solid var(--line-2)',
                borderRadius: 6,
                background: 'var(--surface-2)',
                color: 'var(--ink)',
                padding: '3px 8px',
                font: `600 11px/1 ${FONT}`,
                cursor: 'pointer',
              }}
            >
              + Add condition
            </button>
          </div>

          {form.conditions.length === 0 ? (
            <div
              style={{
                padding: '9px 11px',
                border: '1px dashed var(--line)',
                borderRadius: 8,
                background: 'var(--surface)',
                font: `400 11px/1.4 ${FONT}`,
                color: 'var(--ink-3)',
              }}
            >
              No conditions set. This rule will execute on every trigger event.
            </div>
          ) : (
            form.conditions.map((cond, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1.2fr 1.6fr 32px',
                  gap: 6,
                  alignItems: 'center',
                  background: 'var(--surface)',
                  padding: '7px 8px',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                }}
              >
                <select
                  value={cond.field}
                  onChange={(e) => updateCondition(idx, { field: e.target.value })}
                  style={inputStyle}
                >
                  {fieldsForTrigger.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                <select
                  value={cond.operator}
                  onChange={(e) => updateCondition(idx, { operator: e.target.value })}
                  style={inputStyle}
                >
                  {OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
                <input
                  value={cond.value}
                  onChange={(e) => updateCondition(idx, { value: e.target.value })}
                  placeholder="e.g. 5000 or Dhaka"
                  style={inputStyle}
                />
                <button
                  type="button"
                  aria-label="Remove condition"
                  onClick={() => removeCondition(idx)}
                  style={{
                    height: 32,
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    background: 'var(--surface-2)',
                    color: 'var(--bad)',
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <DcIcon name="icon-x" size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Actions Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={capsLabel}>Actions (Executed in sequence)</span>
            <button
              type="button"
              onClick={addAction}
              style={{
                border: '1px solid var(--violet-bd)',
                borderRadius: 6,
                background: 'var(--violet-soft)',
                color: 'var(--violet)',
                padding: '3px 8px',
                font: `600 11px/1 ${FONT}`,
                cursor: 'pointer',
              }}
            >
              + Add action
            </button>
          </div>

          {form.actions.map((act, idx) => (
            <div
              key={idx}
              style={{
                border: '1px solid var(--line)',
                borderRadius: 9,
                background: 'var(--surface)',
                padding: '10px 11px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 99,
                    background: 'var(--surface-3)',
                    display: 'grid',
                    placeItems: 'center',
                    font: `600 10.5px/1 ${MONO}`,
                    color: 'var(--ink-2)',
                  }}
                >
                  {idx + 1}
                </span>
                <select
                  value={act.action}
                  onChange={(e) => updateAction(idx, e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                >
                  {ACTIONS.map((actionOption) => (
                    <option key={actionOption.value} value={actionOption.value}>
                      {actionOption.label} · {actionOption.hint}
                    </option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveAction(idx, -1)}
                    title="Move up"
                    style={{
                      width: 28,
                      height: 28,
                      border: '1px solid var(--line)',
                      borderRadius: 6,
                      background: 'var(--surface-2)',
                      color: idx === 0 ? 'var(--ink-4)' : 'var(--ink-2)',
                      cursor: idx === 0 ? 'not-allowed' : 'pointer',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <DcIcon name="icon-arrow-up" size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === form.actions.length - 1}
                    onClick={() => moveAction(idx, 1)}
                    title="Move down"
                    style={{
                      width: 28,
                      height: 28,
                      border: '1px solid var(--line)',
                      borderRadius: 6,
                      background: 'var(--surface-2)',
                      color: idx === form.actions.length - 1 ? 'var(--ink-4)' : 'var(--ink-2)',
                      cursor: idx === form.actions.length - 1 ? 'not-allowed' : 'pointer',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <DcIcon name="icon-arrow-down" size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={form.actions.length <= 1}
                    onClick={() => removeAction(idx)}
                    title="Remove action"
                    style={{
                      width: 28,
                      height: 28,
                      border: '1px solid var(--line)',
                      borderRadius: 6,
                      background: 'var(--surface-2)',
                      color: form.actions.length <= 1 ? 'var(--ink-4)' : 'var(--bad)',
                      cursor: form.actions.length <= 1 ? 'not-allowed' : 'pointer',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <DcIcon name="icon-trash-2" size={12} />
                  </button>
                </div>
              </div>

              {/* Action Parameter Inputs */}
              {act.action === 'SEND_EMAIL' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input
                    value={String(act.params['subject'] ?? '')}
                    onChange={(e) => updateActionParam(idx, 'subject', e.target.value)}
                    placeholder="Email Subject (e.g. Order {{invoiceNumber}} Update)"
                    style={inputStyle}
                  />
                  <textarea
                    rows={2}
                    value={String(act.params['message'] ?? act.params['body'] ?? '')}
                    onChange={(e) => updateActionParam(idx, 'message', e.target.value)}
                    placeholder="Email message content (supports {{customerName}}, {{invoiceNumber}}, {{total}})"
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>
              ) : act.action === 'SEND_SMS' || act.action === 'SEND_TELEGRAM' ? (
                <textarea
                  rows={2}
                  value={String(act.params['message'] ?? '')}
                  onChange={(e) => updateActionParam(idx, 'message', e.target.value)}
                  placeholder="Notification text (supports {{customerName}}, {{invoiceNumber}}, {{total}})"
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              ) : act.action === 'BOOK_COURIER' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>Provider:</span>
                  <select
                    value={String(act.params['provider'] ?? 'STEADFAST')}
                    onChange={(e) => updateActionParam(idx, 'provider', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="STEADFAST">Steadfast Courier</option>
                    <option value="PATHAO">Pathao Courier</option>
                    <option value="REDX">REDX</option>
                    <option value="PAPERFLY">Paperfly</option>
                    <option value="SUNDARBAN">Sundarban Courier</option>
                  </select>
                </div>
              ) : act.action === 'UPDATE_ORDER_STATUS' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ font: `500 11.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>New Status:</span>
                  <select
                    value={String(act.params['status'] ?? 'CONFIRMED')}
                    onChange={(e) => updateActionParam(idx, 'status', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="CONFIRMED">CONFIRMED</option>
                    <option value="PROCESSING">PROCESSING</option>
                    <option value="SHIPPED">SHIPPED</option>
                    <option value="DELIVERED">DELIVERED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              ) : act.action === 'APPLY_TAG' || act.action === 'REMOVE_TAG' ? (
                <input
                  value={String(act.params['tag'] ?? '')}
                  onChange={(e) => updateActionParam(idx, 'tag', e.target.value)}
                  placeholder="Customer tag name (e.g. VIP, HIGH_VALUE)"
                  style={inputStyle}
                />
              ) : act.action === 'ADD_LOYALTY_POINTS' ? (
                <input
                  type="number"
                  value={Number(act.params['points'] ?? 0)}
                  onChange={(e) => updateActionParam(idx, 'points', Number(e.target.value))}
                  placeholder="Points to award (e.g. 50)"
                  style={inputStyle}
                />
              ) : act.action === 'CUSTOM_WEBHOOK' ? (
                <input
                  value={String(act.params['url'] ?? '')}
                  onChange={(e) => updateActionParam(idx, 'url', e.target.value)}
                  placeholder="https://your-api.com/automation-endpoint"
                  style={inputStyle}
                />
              ) : (
                <input
                  value={String(act.params['message'] ?? '')}
                  onChange={(e) => updateActionParam(idx, 'message', e.target.value)}
                  placeholder="Notification message"
                  style={inputStyle}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </DcModal>
  )
}
