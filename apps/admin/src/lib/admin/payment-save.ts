import { toastFail, toastApiSaved } from './feedback'
import { verifyPaymentStatus, verifyOrderPaymentPersisted } from './mutation-verify'

export async function confirmOrderPaymentSaved(
  orderId: string,
  save: () => Promise<{ paymentStatus?: string; invoiceNumber?: string }>,
  successLabel: string,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyPaymentStatus(saved, 'PAID')) return false
    if (!(await verifyOrderPaymentPersisted(orderId, 'PAID'))) return false
    toastApiSaved(successLabel)
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not update payment status.')
    return false
  }
}
