import { createBkashViaApi } from '@/lib/server/payment-api-proxy'

export interface MobilePaymentInput {
  orderId: string
  invoiceNumber?: string
  amount: number
  phone: string
}

export interface MobilePaymentResult {
  success: boolean
  paymentId?: string
  redirectUrl?: string
  message: string
}

export async function createPayment(input: MobilePaymentInput): Promise<MobilePaymentResult> {
  if (!input.invoiceNumber) {
    return { success: false, message: 'Order invoice number missing — cannot start bKash' }
  }

  try {
    const result = await createBkashViaApi({
      invoiceNumber: input.invoiceNumber,
      amount: input.amount,
    })
    return {
      success: true,
      paymentId: result.paymentID,
      redirectUrl: result.bkashURL,
      message: 'bKash payment session created',
    }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'bKash payment failed',
    }
  }
}
