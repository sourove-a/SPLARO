'use client'

import { Plus, Zap, Clock, WifiOff } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { AdminButton } from '@/components/ui/AdminButton'
import { AdminEmptyState, AdminTableSkeleton } from '@/components/ui/AdminUiPrimitives'
import { OperationsSubNav } from '@/components/operations/OperationsSubNav'
import { cn } from '@/lib/utils/cn'
import { useAutomationRules } from '@/lib/api/hooks'
import { createAutomationRule, toggleAutomationRule } from '@/lib/api/automation'
import { formatRelativeTime } from '@/lib/api/orders'
import { toastApiSaved, toastFail } from '@/lib/admin/feedback'
import { verifyBooleanEquals } from '@/lib/admin/mutation-verify'

const TRIGGER_LABELS: Record<string, string> = {
  ORDER_PLACED: 'Order Placed',
  ORDER_DELIVERED: 'Order Delivered',
  RETURN_REQUESTED: 'Return Requested',
  CUSTOMER_BIRTHDAY: 'Customer Birthday',
}

const TRIGGERS = ['ORDER_PLACED', 'ORDER_DELIVERED', 'RETURN_REQUESTED', 'CUSTOMER_BIRTHDAY'] as const

export function AutomationRulesPanel() {
  const qc = useQueryClient()
  const { data: rules = [], isLoading, isError, refetch } = useAutomationRules()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState<(typeof TRIGGERS)[number]>('ORDER_PLACED')
  const [smsMessage, setSmsMessage] = useState('SPLARO: Your order update from automation.')
  const [saving, setSaving] = useState(false)

  const handleToggle = async (id: string, isActive: boolean) => {
    const next = !isActive
    try {
      const saved = await toggleAutomationRule(id, next) as { isActive?: boolean }
      if (!verifyBooleanEquals(saved.isActive, next, 'Automation rule state')) return
      toastApiSaved(next ? 'Rule activation' : 'Rule pause')
      void qc.invalidateQueries({ queryKey: ['automation-rules'] })
    } catch {
      toastFail('Could not update rule.')
    }
  }

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toastFail('Rule name is required.')
      return
    }
    setSaving(true)
    try {
      await createAutomationRule({
        name: trimmed,
        trigger,
        conditions: [],
        actions: [
          {
            action: 'SEND_SMS',
            params: { message: smsMessage.trim() || 'SPLARO automation' },
            sortOrder: 0,
          },
        ],
      })
      toastApiSaved('Automation rule')
      setShowCreate(false)
      setName('')
      void qc.invalidateQueries({ queryKey: ['automation-rules'] })
    } catch (e) {
      toastFail(e instanceof Error ? e.message : 'Could not create rule.')
    } finally {
      setSaving(false)
    }
  }

  const ruleStatus = (isLoading ? 'loading' : isError ? 'down' : 'ok') as 'ok' | 'warn' | 'down' | 'loading'
  const statusByHref = { '/dashboard/automation-rules': ruleStatus }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <OperationsSubNav activeHref="/dashboard/automation-rules" statusByHref={statusByHref} />
        <AdminTableSkeleton rows={5} />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <OperationsSubNav activeHref="/dashboard/automation-rules" statusByHref={statusByHref} />
        <div className="admin-health-banner admin-health-banner--warn">
          <p className="admin-health-banner__title admin-health-banner__title--row">
            <WifiOff className="h-4 w-4" />
            API offline — start backend on :4000
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <OperationsSubNav activeHref="/dashboard/automation-rules" statusByHref={statusByHref} />
      <div className="ops-page-header">
        <div>
          <p className="ops-page-header__eyebrow">Operations</p>
          <h2 className="ops-page-header__title">Automation Rules</h2>
          <p className="ops-page-header__sub">Workflow triggers — live from /automation/rules API.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--admin-text-secondary)]">
          {rules.filter((rule) => rule.isActive).length} active · {rules.length} total
        </p>
        <AdminButton variant="gold" onClick={() => setShowCreate((v) => !v)}>
          <Plus className="h-4 w-4" />
          New rule
        </AdminButton>
      </div>

      {showCreate ? (
        <section className="admin-module-card space-y-3">
          <p className="admin-module-card__title">Create rule</p>
          <input
            className="admin-input w-full"
            placeholder="Rule name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select className="admin-input w-full" value={trigger} onChange={(e) => setTrigger(e.target.value as (typeof TRIGGERS)[number])}>
            {TRIGGERS.map((t) => (
              <option key={t} value={t}>
                {TRIGGER_LABELS[t] ?? t}
              </option>
            ))}
          </select>
          <textarea
            className="admin-input min-h-[80px] w-full resize-y"
            placeholder="SMS message when rule fires"
            value={smsMessage}
            onChange={(e) => setSmsMessage(e.target.value)}
          />
          <div className="flex gap-2">
            <AdminButton variant="gold" loading={saving} onClick={() => void handleCreate()}>
              Save rule
            </AdminButton>
            <AdminButton variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </AdminButton>
          </div>
        </section>
      ) : null}

      {rules.length === 0 ? (
        <AdminEmptyState
          icon={Zap}
          title="No automation rules yet"
          description="Create one to auto-flag COD risk, upgrade loyalty tiers, and more."
          action={
            <AdminButton variant="gold" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              New rule
            </AdminButton>
          }
        />
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={cn('admin-module-card', !rule.isActive && 'opacity-70')}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--admin-gold-muted)]">
                  <Zap className="h-4 w-4 text-[var(--admin-accent)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black text-[var(--admin-text-strong)]">{rule.name}</p>
                    <button
                      type="button"
                      onClick={() => void handleToggle(rule.id, rule.isActive)}
                      className={cn(
                        'admin-status',
                        rule.isActive ? 'admin-status--delivered' : 'admin-status--pending',
                      )}
                    >
                      {rule.isActive ? 'Active' : 'Paused'}
                    </button>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[var(--admin-text-secondary)]">
                    Trigger: {TRIGGER_LABELS[rule.trigger] ?? rule.trigger} · {rule.conditions.length}{' '}
                    conditions · {rule.actions.length} actions
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-[var(--admin-text-muted)]">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {rule.lastRunAt ? formatRelativeTime(rule.lastRunAt) : 'Never run'}
                    </span>
                    <span>{rule.runCount} runs</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="text-xs font-semibold text-[var(--admin-text-muted)] underline-offset-2 hover:underline"
        onClick={() => void refetch()}
      >
        Refresh rules
      </button>
    </div>
  )
}
