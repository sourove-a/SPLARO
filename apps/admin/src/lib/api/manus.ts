import { apiFetch } from './client'

export type ManusAgentProfile = 'manus-1.6' | 'manus-1.6-lite' | 'manus-1.6-max'
export type ManusTaskStatus = 'running' | 'stopped' | 'waiting' | 'error'

export interface ManusTask {
  id: string
  status: ManusTaskStatus
  title: string
  taskUrl: string
  creditUsage: number
  agentProfile: string | null
  createdAt: number
  updatedAt: number
}

export interface ManusTaskEvent {
  id: string
  type: string
  timestamp: number
  content: string
  attachments: { filename: string; url: string; contentType: string }[]
}

export interface ManusStatus {
  configured: boolean
  agentProfiles: ManusAgentProfile[]
}

export function fetchManusStatus() {
  return apiFetch<ManusStatus>('/manus/status')
}

export function fetchManusTasks(limit = 20) {
  return apiFetch<{ tasks: ManusTask[]; nextCursor: string | null }>(`/manus/tasks?limit=${limit}`)
}

export function fetchManusMessages(taskId: string, limit = 50) {
  return apiFetch<ManusTaskEvent[]>(
    `/manus/tasks/${encodeURIComponent(taskId)}/messages?limit=${limit}`,
  )
}

export function createManusTask(body: {
  prompt: string
  agentProfile?: ManusAgentProfile
  title?: string
}) {
  return apiFetch<{ taskId: string; title: string; taskUrl: string }>('/manus/tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function stopManusTask(taskId: string) {
  return apiFetch<{ ok: true }>(`/manus/tasks/${encodeURIComponent(taskId)}/stop`, {
    method: 'POST',
  })
}
