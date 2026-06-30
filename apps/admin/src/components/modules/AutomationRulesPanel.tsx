'use client'

import toast from 'react-hot-toast'
import { Plus, Zap, Clock, WifiOff } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { AdminButton } from '@/components/ui/AdminButton'
import { OperationsSubNav } from '@/components/operations/OperationsSubNav'
import { cn } from '@/lib/utils/cn'
import { useAutomationRules } from '@/lib/api/hooks'
import { toggleAutomationRule } from '@/lib/api/automation'
import { formatRelativeTime } from '@/lib/api/orders'

const TRIGGER_LABELS: Record<string, string> = {
  ORDER_PLACED: 'Order Placed',
  ORDER_DELIVERED: 'Order Delivered',
  RETURN_REQUESTED: 'Return Requested',
  CUSTOMER_BIRTHDAY: 'Customer Birthday',
}

export function AutomationRulesPanel() {
  const qc = useQueryClient()
  const { data: rules = [], isLoading, isError, refetch } = useAutomationRules()

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await toggleAutomationRule(id, !isActive)
      toast.success(isActive ? 'Rule paused.' : 'Rule activated.')
      void qc.invalidateQueries({ queryKey: ['automation-rules'] })
    } catch {
      toast.error('Could not update rule.')
    }
  }

  const ruleStatus = (isLoading ? 'loading' : isError ? 'down' : 'ok') as 'ok' | 'warn' | 'down' | 'loading'
  const statusByHref = { '/dashboard/automation-rules': ruleStatus }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <OperationsSubNav activeHref="/dashboard/automation-rules" statusByHref={statusByHref} />
        <p className="text-sm text-[var(--admin-text-muted)]">Loading automation rules…</p>
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
        <AdminButton variant="gold" onClick={() => toast('Rule builder opens from Automation → Create rule.')}>
          <Plus className="h-4 w-4" />
          New rule
        </AdminButton>
      </div>

      {rules.length === 0 ? (
        <div className="admin-module-card text-sm text-[var(--admin-text-muted)]">
          No automation rules yet. Create one to auto-flag COD risk, upgrade loyalty tiers, and more.
        </div>
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
