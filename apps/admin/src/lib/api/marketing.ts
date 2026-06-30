import { apiFetch } from './client'

export interface ApiCampaign {
  id: string
  name: string
  type: string
  status: string
  subject: string | null
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  scheduledAt: string | null
  sentAt: string | null
  createdAt: string
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

export function sendCampaign(id: string) {
  return apiFetch<{ sent: number }>(`/marketing/campaigns/${id}/send`, { method: 'POST' })
}

export function mapCampaignStatus(status: string): 'draft' | 'scheduled' | 'live' | 'ended' {
  const normalized = status.toUpperCase()
  if (normalized === 'DRAFT') return 'draft'
  if (normalized === 'SCHEDULED') return 'scheduled'
  if (normalized === 'SENDING' || normalized === 'SENT') return 'live'
  return 'ended'
}
