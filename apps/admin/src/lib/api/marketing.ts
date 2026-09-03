import { apiFetch, getStoreId } from './client'

export type CampaignType = 'EMAIL' | 'SMS' | 'WHATSAPP'
export type CampaignAudience = 'ALL' | 'LOYAL' | 'INACTIVE' | 'HIGH_SPENDERS' | 'TAG'

export interface CreateCampaignInput {
  name: string
  subject: string
  body: string
  type: CampaignType
  targetAudience?: CampaignAudience
  targetTag?: string
  scheduledAt?: string
}

export interface UpdateCampaignInput {
  name?: string
  subject?: string
  body?: string
}

export interface ApiCampaign {
  id: string
  name: string
  type: string
  status: string
  subject: string | null
  body?: string
  recipientType?: string
  recipientTags?: string[]
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

export interface AudienceEstimateResponse {
  count: number
  totalCustomers: number
  breakdown: {
    ALL: number
    LOYAL: number
    HIGH_SPENDERS: number
    INACTIVE: number
  }
}

export interface CampaignRecipient {
  id: string
  name: string
  firstName?: string
  lastName?: string
  phone?: string
  email?: string | null
  formattedMessage: string
  whatsAppUrl: string
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

export function fetchAudienceEstimate(query: {
  type?: CampaignType
  audience?: CampaignAudience
  tag?: string
}) {
  const params = new URLSearchParams()
  if (query.type) params.set('type', query.type)
  if (query.audience) params.set('audience', query.audience)
  if (query.tag) params.set('tag', query.tag)
  return apiFetch<AudienceEstimateResponse>(`/marketing/campaigns/audience-estimate?${params.toString()}`)
}

export function fetchCampaignRecipients(id: string) {
  return apiFetch<CampaignRecipient[]>(`/marketing/campaigns/${encodeURIComponent(id)}/recipients`)
}

export function createCampaign(data: CreateCampaignInput) {
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
      ...(data.scheduledAt ? { scheduledAt: data.scheduledAt } : {}),
    }),
  })
}

export function updateCampaign(id: string, data: UpdateCampaignInput) {
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

export function mapCampaignStatus(
  status: string,
): 'draft' | 'scheduled' | 'live' | 'ended' | 'failed' {
  const normalized = status.toUpperCase()
  if (normalized === 'DRAFT') return 'draft'
  if (normalized === 'SCHEDULED') return 'scheduled'
  if (normalized === 'SENDING' || normalized === 'SENT') return 'live'
  if (normalized === 'FAILED') return 'failed'
  return 'ended'
}

export function formatCampaignType(type: string): string {
  const t = (type || '').toUpperCase()
  if (t === 'WHATSAPP') return 'WhatsApp'
  if (t === 'EMAIL') return 'Email'
  if (t === 'SMS') return 'SMS'
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
