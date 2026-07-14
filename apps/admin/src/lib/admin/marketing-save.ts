import { toastApiSaved, toastFail, toastWarn } from './feedback'
import {
  verifyCampaignDeleteResponse,
  verifyCampaignDeleted,
  verifyCampaignPersisted,
  verifyCampaignResponse,
  verifyCampaignSendResponse,
  verifyCampaignSentPersisted,
} from './marketing-mutation-verify'

export async function confirmCampaignCreated(
  expected: { name: string; type: string },
  save: () => Promise<unknown>,
): Promise<string | null> {
  try {
    const saved = await save()
    if (!verifyCampaignResponse(saved, { ...expected, status: 'DRAFT' })) return null
    const id = saved && typeof saved === 'object' && 'id' in saved ? String((saved as { id: string }).id) : ''
    if (!id || !(await verifyCampaignPersisted(id, { name: expected.name, type: expected.type, status: 'DRAFT' }))) {
      return null
    }
    toastApiSaved(`Campaign "${expected.name}" saved to server`)
    return id
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not create campaign.')
    return null
  }
}

export async function confirmCampaignSent(
  id: string,
  save: () => Promise<unknown>,
): Promise<number | null> {
  try {
    const saved = await save()
    if (!verifyCampaignSendResponse(saved)) return null
    const sent =
      saved && typeof saved === 'object' && 'sent' in saved ? Number((saved as { sent: number }).sent) : 0
    if (!(await verifyCampaignSentPersisted(id))) return null
    toastWarn(`Campaign queued — ${sent} recipient(s). Refresh to confirm delivery.`, `campaign-queued:${id}`)
    return sent
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not send campaign.')
    return null
  }
}

export async function confirmCampaignScheduled(
  id: string,
  scheduledAt: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyCampaignResponse(saved, { status: 'SCHEDULED', scheduledAt })) return false
    if (!(await verifyCampaignPersisted(id, { status: 'SCHEDULED', scheduledAt }))) return false
    const dateLabel = scheduledAt.slice(0, 10)
    toastApiSaved(`Campaign scheduled for ${dateLabel}`)
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not schedule campaign.')
    return false
  }
}

export async function confirmCampaignDuplicated(
  expectedName: string,
  save: () => Promise<unknown>,
): Promise<string | null> {
  try {
    const saved = await save()
    if (!verifyCampaignResponse(saved, { name: expectedName, status: 'DRAFT' })) return null
    const id = saved && typeof saved === 'object' && 'id' in saved ? String((saved as { id: string }).id) : ''
    if (!id || !(await verifyCampaignPersisted(id, { name: expectedName, status: 'DRAFT' }))) return null
    toastApiSaved(`Duplicated as "${expectedName}"`)
    return id
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not duplicate campaign.')
    return null
  }
}

export async function confirmCampaignDeleted(
  id: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyCampaignDeleteResponse(saved, id)) return false
    if (!(await verifyCampaignDeleted(id))) return false
    toastApiSaved('Campaign deleted')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not delete campaign.')
    return false
  }
}
