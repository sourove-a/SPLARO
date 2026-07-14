import { fetchCampaign, fetchCampaigns, type ApiCampaign } from '@/lib/api/marketing'
import {
  verifyPersisted,
  verifyStringEquals,
} from './mutation-verify'
import { toastFail } from './feedback'

function hasId(saved: unknown): saved is { id: string } {
  return Boolean(saved && typeof saved === 'object' && 'id' in saved && String((saved as { id: unknown }).id).trim())
}

export function verifyCampaignResponse(
  saved: unknown,
  expected: { name?: string; type?: string; status?: string; scheduledAt?: string | null },
): boolean {
  if (!hasId(saved)) return verifyPersisted(false, 'Campaign did not persist on server')
  const row = saved as ApiCampaign
  if (expected.name !== undefined && !verifyStringEquals(row.name, expected.name, 'Campaign name')) {
    return false
  }
  if (expected.type !== undefined && !verifyStringEquals(row.type, expected.type, 'Campaign type')) {
    return false
  }
  if (expected.status !== undefined && !verifyStringEquals(row.status, expected.status, 'Campaign status')) {
    return false
  }
  if (expected.scheduledAt !== undefined) {
    const got = row.scheduledAt ? new Date(row.scheduledAt).toISOString() : null
    const want = expected.scheduledAt ? new Date(expected.scheduledAt).toISOString() : null
    if (!verifyPersisted(got === want, 'Campaign schedule did not persist on server')) return false
  }
  return true
}

export async function verifyCampaignPersisted(
  id: string,
  expected: { name?: string; type?: string; status?: string; scheduledAt?: string | null },
): Promise<boolean> {
  try {
    const campaign = await fetchCampaign(id)
    return verifyCampaignResponse(campaign, expected)
  } catch {
    toastFail('Could not verify campaign on server')
    return false
  }
}

export function verifyCampaignSendResponse(saved: unknown): boolean {
  if (!saved || typeof saved !== 'object') {
    return verifyPersisted(false, 'Campaign send did not persist on server')
  }
  const sent = Number((saved as { sent?: unknown }).sent)
  return verifyPersisted(Number.isFinite(sent) && sent >= 0, 'Campaign send did not persist on server')
}

export async function verifyCampaignSentPersisted(id: string): Promise<boolean> {
  try {
    const campaign = await fetchCampaign(id)
    const status = campaign.status.toUpperCase()
    return verifyPersisted(
      status === 'SENDING' || status === 'SENT',
      'Campaign send did not persist on server',
    )
  } catch {
    toastFail('Could not verify campaign send on server')
    return false
  }
}

export function verifyCampaignDeleteResponse(saved: unknown, id: string): boolean {
  if (!saved || typeof saved !== 'object') {
    return verifyPersisted(false, 'Campaign delete did not persist on server')
  }
  const deleted = 'deleted' in saved ? String((saved as { deleted: unknown }).deleted) : ''
  return verifyStringEquals(deleted, id, 'Campaign delete')
}

export async function verifyCampaignDeleted(id: string): Promise<boolean> {
  try {
    const campaigns = await fetchCampaigns()
    const row = campaigns.find((c) => c.id === id)
    return verifyPersisted(!row, 'Campaign delete did not persist on server')
  } catch {
    toastFail('Could not verify campaign delete on server')
    return false
  }
}
