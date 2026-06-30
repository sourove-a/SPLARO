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
  const appKey = process.env.BKASH_APP_KEY
  const appSecret = process.env.BKASH_APP_SECRET
  const paymentId = `bkash_${input.orderId}_${Date.now()}`

  if (!appKey || !appSecret) {
    if (!allowDevPaymentStub()) {
      return {
        success: false,
        message: 'bKash credentials are not configured',
      }
    }

    serverLog('bkash', 'dev stub payment (credentials missing)', {
      orderId: input.orderId,
      amount: input.amount,
      phone: input.phone,
    })

    return {
      success: true,
      paymentId,
      redirectUrl: mobilePaymentPageUrl(input.orderId, 'bkash', paymentId),
      message: 'bKash dev stub — set BKASH_* env vars for live gateway',
    }
  }

  const baseUrl = process.env.BKASH_BASE_URL ?? 'https://tokenized.sandbox.bka.sh/v1.2.0-beta'

  serverLog('bkash', 'create payment stub', {
    orderId: input.orderId,
    amount: input.amount,
    phone: input.phone,
    baseUrl,
  })

  return {
    success: true,
    paymentId,
    redirectUrl: mobilePaymentPageUrl(input.orderId, 'bkash', paymentId),
    message: 'bKash payment session created (stub)',
  }
}
