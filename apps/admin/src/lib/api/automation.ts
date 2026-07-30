import { apiFetch, getStoreId } from './client'

export interface ApiAutomationRule {
  id: string
  name: string
  description?: string | null
  trigger: string
  isActive: boolean
  runCount: number
  lastRunAt: string | null
  conditions: { id: string; field: string; operator: string; value: string }[]
  actions: {
    id: string
    action: string
    params: Record<string, unknown>
    sortOrder: number
  }[]
}

export interface AutomationStats {
  rules: Array<{
    id: string
    name: string
    trigger: string
    isActive: boolean
    runCount: number
    lastRunAt: string | null
    _count: { logs: number }
  }>
  totalRuns: number
  successCount: number
  failCount: number
  successRate: number
}

export interface AutomationLog {
  id: string
  ruleId: string
  triggeredBy: string | null
  success: boolean
  errorMsg: string | null
  createdAt: string
  rule: { name: string; trigger: string }
}

export interface AutomationLogsResponse {
  items: AutomationLog[]
  total: number
  page: number
  limit: number
}

export function fetchAutomationRules() {
  return apiFetch<ApiAutomationRule[]>('/automation/rules')
}

export function toggleAutomationRule(id: string, isActive: boolean) {
  return apiFetch<ApiAutomationRule>(`/automation/rules/${id}/toggle`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  })
}

export function deleteAutomationRule(id: string) {
  return apiFetch<{ deleted: string }>(`/automation/rules/${id}`, {
    method: 'DELETE',
  })
}

export function fetchAutomationStats() {
  return apiFetch<AutomationStats>('/automation/stats')
}

export function fetchAutomationLogs(limit = 20) {
  return apiFetch<AutomationLogsResponse>(`/automation/logs?limit=${limit}`)
}

export function createAutomationRule(input: {
  name: string
  description?: string
  trigger: string
  conditions?: { field: string; operator: string; value: string }[]
  actions: { action: string; params: Record<string, unknown>; sortOrder: number }[]
}) {
  return apiFetch<ApiAutomationRule>('/automation/rules', {
    method: 'POST',
    body: JSON.stringify({ ...input, storeId: getStoreId() }),
  })
}
