import { serverLog } from '@/lib/server/log'

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

function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

function mobilePaymentPageUrl(
  orderId: string,
  provider: 'bkash' | 'nagad',
  paymentId: string,
): string {
  const params = new URLSearchParams({
    orderId,
    provider,
    paymentId,
  })
  return `${getSiteUrl()}/checkout/mobile-payment?${params.toString()}`
}

function allowDevPaymentStub(): boolean {
  return process.env.PAYMENT_DEV_STUB === 'true' || process.env.NODE_ENV === 'development'
}

export async function createPayment(input: MobilePaymentInput): Promise<MobilePaymentResult> {
  const merchantId = process.env.NAGAD_MERCHANT_ID
  const privateKey = process.env.NAGAD_MERCHANT_PRIVATE_KEY
  const paymentId = `nagad_${input.orderId}_${Date.now()}`

  if (!merchantId || !privateKey) {
    if (!allowDevPaymentStub()) {
      return {
        success: false,
        message: 'Nagad credentials are not configured',
      }
    }

    serverLog('nagad', 'dev stub payment (credentials missing)', {
      orderId: input.orderId,
      amount: input.amount,
      phone: input.phone,
    })

    return {
      success: true,
      paymentId,
      redirectUrl: mobilePaymentPageUrl(input.orderId, 'nagad', paymentId),
      message: 'Nagad dev stub — set NAGAD_* env vars for live gateway',
    }
  }

  const baseUrl = process.env.NAGAD_BASE_URL ?? 'http://sandbox.mynagad.com:10080'

  serverLog('nagad', 'create payment stub', {
    orderId: input.orderId,
    amount: input.amount,
    phone: input.phone,
    merchantId,
    baseUrl,
  })

  return {
    success: true,
    paymentId,
    redirectUrl: mobilePaymentPageUrl(input.orderId, 'nagad', paymentId),
    message: 'Nagad payment session created (stub)',
  }
}
