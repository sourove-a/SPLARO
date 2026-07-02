import { initSslCommerzViaApi } from '@/lib/server/payment-api-proxy'

export interface PaymentInitInput {
  orderId: string
  invoiceNumber?: string
  amount: number
  customer: {
    name: string
    email: string
    phone: string
    address: string
    city: string
  }
}

export interface PaymentInitResult {
  success: boolean
  gatewayUrl?: string
  sessionKey?: string
  message: string
}

export async function initPayment(input: PaymentInitInput): Promise<PaymentInitResult> {
  if (!input.invoiceNumber) {
    return { success: false, message: 'Order invoice number missing — cannot start SSLCommerz' }
  }

  try {
    const result = await initSslCommerzViaApi({
      invoiceNumber: input.invoiceNumber,
      amount: input.amount,
      customer: input.customer,
    })
    return {
      success: true,
      gatewayUrl: result.gatewayUrl,
      sessionKey: result.sessionKey,
      message: 'SSLCommerz session created',
    }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'SSLCommerz payment failed',
    }
  }
}

export interface IPNValidationResult {
  valid: boolean
  orderId?: string
  transactionId?: string
  amount?: number
  message: string
}

/** Legacy stub — live IPN is handled by Nest API `/payments/ssl/ipn`. */
export async function validateIPN(payload: Record<string, string>): Promise<IPNValidationResult> {
  const orderId = payload.tran_id ?? payload.value_a
  if (!orderId) return { valid: false, message: 'Missing order reference' }
  return { valid: false, orderId, message: 'Use Nest API SSL IPN endpoint for live validation' }
}
