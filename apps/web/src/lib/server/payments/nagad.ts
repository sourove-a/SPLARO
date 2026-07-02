import { initNagadViaApi } from '@/lib/server/payment-api-proxy'

export interface MobilePaymentInput {
  orderId: string
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
  try {
    const result = await initNagadViaApi({
      orderId: input.orderId,
      amount: input.amount,
    })
    return {
      success: true,
      paymentId: result.paymentRefId,
      redirectUrl: result.url,
      message: 'Nagad payment session created',
    }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Nagad payment failed',
    }
  }
}
