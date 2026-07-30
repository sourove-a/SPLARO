'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
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
  { value: 'SEND_TELEGRAM', label: 'Send Telegram', hint: 'Notifies linked admin channel' },
  { value: 'NOTIFY_ADMIN', label: 'Notify admin', hint: 'Creates admin notification' },
] as const

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
  const [form, setForm] = useState({
    name: '',
    trigger: 'ORDER_PLACED',
    action: 'SEND_SMS',
    message: 'SPLARO: Your order update from automation.',
  })

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
    const message = form.message.trim()
    if (!name) {
      toastFail('Rule name is required')
      return
    }
    if (!message) {
      toastFail('Action message is required')
      return
    }

    setSaving(true)
    try {
      const saved = await createAutomationRule({
        name,
        trigger: form.trigger,
        conditions: [],
        actions: [
          {
            action: form.action,
            params:
              form.action === 'NOTIFY_ADMIN'
                ? { subject: name, message }
                : { message },
            sortOrder: 0,
          },
        ],
      })
      if (!verifyStringEquals(saved.name, name, 'Automation rule name')) return
      if (!verifyStringEquals(saved.trigger, form.trigger, 'Automation trigger')) return
      if (!verifyBooleanEquals(saved.isActive, true, 'Automation rule active state')) return
      if (!verifyPersisted(Boolean(saved.id && saved.actions[0]), 'Automation rule action did not persist')) return
      toastApiSaved('Automation rule created')
      setCreateOpen(false)
      setForm({
        name: '',
        trigger: 'ORDER_PLACED',
        action: 'SEND_SMS',
        message: 'SPLARO: Your order update from automation.',
      })
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
      ) : (
        <>
          <AutomationKpis
            active={active}
            total={rows.length}
            runs={stats.data?.totalRuns ?? rows.reduce((sum, row) => sum + row.runCount, 0)}
            actions={stats.data?.successCount ?? 0}
            failures={stats.data?.failCount ?? 0}
            successRate={stats.data?.successRate ?? 100}
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
  actions: number
  failures: number
  successRate: number
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: 12 }}>
      <Kpi label="Rules active" value={String(active)} sub={`of ${total} defined`} tone="vio" />
      <Kpi label="Total runs" value={String(runs)} sub="worker execution log" tone="info" />
      <Kpi label="Actions completed" value={String(actions)} sub={`${successRate}% success rate`} tone="ok" />
      <Kpi label="Failures recorded" value={String(failures)} sub="all retained in log" tone={failures ? 'warn' : 'ok'} />
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
        {rows.map((row, index) => (
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
              <strong style={{ font: `600 12px/1.2 ${FONT}`, color: 'var(--ink)' }}>{row.name}</strong>
              <span style={{ font: `400 10.5px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>
                {TRIGGER_LABELS[row.trigger] ?? row.trigger} → {actionLabel(row.actions[0]?.action)}
                {row.conditions.length ? ` · ${row.conditions.length} conditions` : ' · every event'}
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
        ))}
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
  form: { name: string; trigger: string; action: string; message: string }
  onChange: (next: { name: string; trigger: string; action: string; message: string }) => void
  onClose: () => void
  onConfirm: () => void
}) {
  const inputStyle = {
    width: '100%',
    minHeight: 36,
    padding: '8px 10px',
    border: '1px solid var(--line)',
    borderRadius: 9,
    outline: 0,
    background: 'var(--surface-2)',
    color: 'var(--ink)',
    font: `400 12px/1.4 ${FONT}`,
  } as const

  return (
    <DcModal
      open={open}
      title="New automation rule"
      subtitle="Rule starts active. Every run is written to server log."
      confirmLabel="Create rule"
      busy={busy}
      onClose={onClose}
      onConfirm={onConfirm}
    >
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={capsLabel}>Rule name</span>
        <input
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
          placeholder="Confirm paid orders"
          style={inputStyle}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={capsLabel}>When this happens</span>
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
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={capsLabel}>Do this</span>
        <select
          value={form.action}
          onChange={(event) => onChange({ ...form, action: event.target.value })}
          style={inputStyle}
        >
          {ACTIONS.map((action) => (
            <option key={action.value} value={action.value}>{action.label} · {action.hint}</option>
          ))}
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={capsLabel}>Message</span>
        <textarea
          rows={3}
          value={form.message}
          onChange={(event) => onChange({ ...form, message: event.target.value })}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </label>
      <div
        style={{
          padding: '10px 11px',
          border: '1px solid var(--info-bd)',
          borderRadius: 9,
          background: 'var(--info-soft)',
          font: `400 11px/1.45 ${FONT}`,
          color: 'var(--ink-2)',
        }}
      >
        No conditions means action runs for every matching event. Pause rule anytime from list.
      </div>
    </DcModal>
  )
}
