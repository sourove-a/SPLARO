import { serverLog } from '@/lib/server/log'

export interface PaymentInitInput {
  orderId: string
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

function getCredentials() {
  const storeId = process.env.SSLCOMMERZ_STORE_ID
  const storePassword =
    process.env.SSLCOMMERZ_STORE_PASSWD ?? process.env.SSLCOMMERZ_STORE_PASSWORD

  return { storeId, storePassword }
}

export async function initPayment(input: PaymentInitInput): Promise<PaymentInitResult> {
  const { storeId, storePassword } = getCredentials()

  if (!storeId || !storePassword) {
    return {
      success: false,
      message: 'SSLCommerz credentials are not configured',
    }
  }

  const baseUrl = process.env.SSLCOMMERZ_BASE_URL ?? 'https://sandbox.sslcommerz.com'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const sessionKey = `ssl_${input.orderId}_${Date.now()}`

  serverLog('sslcommerz', 'init payment stub', {
    storeId,
    orderId: input.orderId,
    amount: input.amount,
    customer: input.customer.email,
  })

  return {
    success: true,
    gatewayUrl: `${baseUrl}/gwprocess/v4/api.php`,
    sessionKey,
    message: `Redirect customer to SSLCommerz · success URL ${siteUrl}/checkout?order=${encodeURIComponent(input.orderId)}`,
  }
}

export interface IPNValidationResult {
  valid: boolean
  orderId?: string
  transactionId?: string
  amount?: number
  message: string
}

export async function validateIPN(payload: Record<string, string>): Promise<IPNValidationResult> {
  const { storeId, storePassword } = getCredentials()

  if (!storeId || !storePassword) {
    return { valid: false, message: 'SSLCommerz credentials are not configured' }
  }

  const status = payload.status ?? payload.tran_status
  const orderId = payload.tran_id ?? payload.value_a
  const transactionId = payload.bank_tran_id ?? payload.tran_id
  const amount = Number(payload.amount ?? payload.total_amount ?? '0')

  serverLog('sslcommerz', 'ipn stub', {
    status,
    orderId,
    transactionId,
    amount,
  })

  if (!orderId) {
    return { valid: false, message: 'Missing order reference' }
  }

  if (status && !['VALID', 'VALIDATED', 'SUCCESS', 'APPROVED'].includes(status.toUpperCase())) {
    return { valid: false, orderId, message: `Payment not successful (${status})` }
  }

  return {
    valid: true,
    orderId,
    amount,
    message: 'IPN validated (stub)',
    ...(transactionId ? { transactionId } : {}),
  }
}
