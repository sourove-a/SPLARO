import { apiFetch } from './client'

export interface ApiAutomationRule {
  id: string
  name: string
  trigger: string
  isActive: boolean
  runCount: number
  lastRunAt: string | null
  conditions: { id: string }[]
  actions: { id: string }[]
}

export function fetchAutomationRules() {
  return apiFetch<ApiAutomationRule[]>('/automation/rules')
}

export function toggleAutomationRule(id: string, isActive: boolean) {
  return apiFetch(`/automation/rules/${id}/toggle`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  })
}
