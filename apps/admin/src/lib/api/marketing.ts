import { apiFetch, getStoreId } from './client'

export interface ApiCampaign {
  id: string
  name: string
  type: string
  status: string
  subject: string | null
  body?: string
  recipientType?: string
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  scheduledAt: string | null
  sentAt: string | null
  createdAt: string
}

export interface CampaignStatsResponse {
  byStatus: Array<{ status: string; _count: number }>
  byType: Array<{ type: string; _count: number }>
  totalSent: number
  totalOpened: number
  totalClicked: number
  openRate: number
  clickRate: number
}

interface CampaignsPage {
  items: ApiCampaign[]
  total: number
  page: number
  limit: number
}

export async function fetchCampaigns(): Promise<ApiCampaign[]> {
  const res = await apiFetch<CampaignsPage | ApiCampaign[]>('/marketing/campaigns?limit=100')
  return Array.isArray(res) ? res : (res.items ?? [])
}

export function fetchCampaignStats() {
  return apiFetch<CampaignStatsResponse>('/marketing/campaigns/stats')
}

export function fetchCampaign(id: string) {
  return apiFetch<ApiCampaign>(`/marketing/campaigns/${encodeURIComponent(id)}`)
}

export function createCampaign(data: {
  name: string
  subject: string
  body: string
  type: 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP'
  targetAudience?: 'ALL' | 'LOYAL' | 'INACTIVE' | 'HIGH_SPENDERS' | 'TAG'
  targetTag?: string
}) {
  return apiFetch<ApiCampaign>('/marketing/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      storeId: getStoreId(),
      targetAudience: data.targetAudience ?? 'ALL',
      name: data.name,
      subject: data.subject,
      body: data.body,
      type: data.type,
      ...(data.targetTag ? { targetTag: data.targetTag } : {}),
    }),
  })
}

export function updateCampaign(
  id: string,
  data: {
    name?: string
    subject?: string
    body?: string
    scheduledAt?: string
    status?: string
  },
) {
  return apiFetch<ApiCampaign>(`/marketing/campaigns/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteCampaign(id: string) {
  return apiFetch<{ deleted: string }>(`/marketing/campaigns/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export function duplicateCampaign(id: string) {
  return apiFetch<ApiCampaign>(`/marketing/campaigns/${encodeURIComponent(id)}/duplicate`, {
    method: 'POST',
  })
}

export function sendCampaign(id: string) {
  return apiFetch<{ sent: number }>(`/marketing/campaigns/${encodeURIComponent(id)}/send`, {
    method: 'POST',
  })
}

export function mapCampaignStatus(status: string): 'draft' | 'scheduled' | 'live' | 'ended' {
  const normalized = status.toUpperCase()
  if (normalized === 'DRAFT') return 'draft'
  if (normalized === 'SCHEDULED') return 'scheduled'
  if (normalized === 'SENDING' || normalized === 'SENT') return 'live'
  return 'ended'
}

export function formatCampaignType(type: string): string {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}
