import { toastFail, toastApiSaved } from './feedback'
import { verifyPaymentStatus, verifyOrderPaymentPersisted } from './mutation-verify'

export interface PaymentEvidence {
  reference: string
  amount: number
  method?: string
  note?: string
}

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

/** Prompt admin for reference + amount before marking PAID. Returns null if cancelled/invalid. */
export function collectPaymentEvidence(defaultAmount: number): PaymentEvidence | null {
  const reference = window.prompt('Payment reference (trx id / bKash / Nagad number):')?.trim() ?? ''
  if (reference.length < 3) {
    if (reference.length > 0) toastFail('Reference must be at least 3 characters.')
    return null
  }
  const amountRaw = window.prompt('Amount received (BDT):', String(defaultAmount))?.trim() ?? ''
  const amount = Number(amountRaw)
  if (!Number.isFinite(amount) || amount < 0) {
    toastFail('Enter a valid amount received.')
    return null
  }
  return { reference, amount }
}
