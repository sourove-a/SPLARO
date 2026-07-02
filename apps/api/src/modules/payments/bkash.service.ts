import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { PaymentIntegrationService } from '../integrations/payment-integration.service'

interface BkashTokenResponse {
  id_token: string
  expires_in: number
}

export interface BkashCreatePaymentResponse {
  paymentID: string
  bkashURL: string
  callbackURL: string
  successCallbackURL: string
  failureCallbackURL: string
  cancelledCallbackURL: string
  amount: string
  currency: string
  intent: string
  merchantInvoiceNumber: string
}

export interface BkashExecuteResponse {
  paymentID: string
  trxID: string
  transactionStatus: string
  amount: string
  currency: string
  merchantInvoiceNumber: string
}

type BkashRuntime = Awaited<ReturnType<PaymentIntegrationService['resolveRuntimeCredentials']>>

@Injectable()
export class BkashService {
  private readonly logger = new Logger(BkashService.name)
  private readonly tokenCache = new Map<string, { token: string; expiry: Date }>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentIntegration: PaymentIntegrationService,
  ) {}

  private baseUrl(creds: BkashRuntime): string {
    return creds.sandbox
      ? 'https://tokenized.sandbox.bka.sh/v1.2.0-beta'
      : 'https://tokenized.pay.bka.sh/v1.2.0-beta'
  }

  private async resolveStoreId(storeIdOrSlug?: string, invoiceNumber?: string): Promise<string> {
    if (storeIdOrSlug) return resolveStoreId(this.prisma, storeIdOrSlug)
    if (invoiceNumber) {
      const order = await this.prisma.order.findUnique({
        where: { invoiceNumber },
        select: { storeId: true },
      })
      if (order) return order.storeId
    }
    return resolveStoreId(this.prisma)
  }

  private async getCredentials(storeIdOrSlug?: string, invoiceNumber?: string) {
    const storeId = await this.resolveStoreId(storeIdOrSlug, invoiceNumber)
    const creds = await this.paymentIntegration.resolveRuntimeCredentials(storeId, 'bkash')
    if (!creds.appKey || !creds.appSecret || !creds.username || !creds.password) {
      throw new Error('bKash credentials are not configured — save keys in Admin → Settings → Payments')
    }
    return { storeId, creds }
  }

  private async getToken(creds: BkashRuntime, storeId: string): Promise<string> {
    const cacheKey = `${storeId}:${creds.appKey}`
    const cached = this.tokenCache.get(cacheKey)
    if (cached && cached.expiry > new Date()) return cached.token

    const baseUrl = this.baseUrl(creds)
    const response = await axios.post<BkashTokenResponse>(
      `${baseUrl}/tokenized/checkout/token/grant`,
      { app_key: creds.appKey, app_secret: creds.appSecret },
      {
        headers: {
          username: creds.username,
          password: creds.password,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      },
    )

    const token = response.data.id_token
    this.tokenCache.set(cacheKey, {
      token,
      expiry: new Date(Date.now() + (response.data.expires_in - 60) * 1000),
    })
    return token
  }

  private async getAuthHeaders(creds: BkashRuntime, storeId: string) {
    const token = await this.getToken(creds, storeId)
    return {
      Authorization: token,
      'X-APP-Key': creds.appKey,
      'Content-Type': 'application/json',
    }
  }

  async createPayment(data: {
    amount: number
    invoiceNumber: string
    callbackUrl: string
    storeId?: string
  }): Promise<BkashCreatePaymentResponse> {
    const { storeId, creds } = await this.getCredentials(data.storeId, data.invoiceNumber)
    const headers = await this.getAuthHeaders(creds, storeId)
    const baseUrl = this.baseUrl(creds)

    const response = await axios.post<BkashCreatePaymentResponse>(
      `${baseUrl}/tokenized/checkout/create`,
      {
        mode: '0011',
        payerReference: data.invoiceNumber,
        callbackURL: data.callbackUrl,
        amount: data.amount.toFixed(2),
        currency: 'BDT',
        intent: 'sale',
        merchantInvoiceNumber: data.invoiceNumber,
      },
      { headers, timeout: 15000 },
    )

    this.logger.log(`bKash payment created: ${response.data.paymentID} for ${data.invoiceNumber}`)
    return response.data
  }

  async executePayment(paymentId: string, invoiceNumber?: string): Promise<BkashExecuteResponse> {
    const { storeId, creds } = await this.getCredentials(undefined, invoiceNumber)
    const headers = await this.getAuthHeaders(creds, storeId)
    const baseUrl = this.baseUrl(creds)

    const response = await axios.post<BkashExecuteResponse>(
      `${baseUrl}/tokenized/checkout/execute`,
      { paymentID: paymentId },
      { headers, timeout: 15000 },
    )

    this.logger.log(`bKash payment executed: ${response.data.trxID} — status: ${response.data.transactionStatus}`)
    return response.data
  }

  async queryPayment(paymentId: string, invoiceNumber?: string): Promise<{ transactionStatus: string; trxID?: string }> {
    const { storeId, creds } = await this.getCredentials(undefined, invoiceNumber)
    const headers = await this.getAuthHeaders(creds, storeId)
    const baseUrl = this.baseUrl(creds)

    const response = await axios.post<{ transactionStatus: string; trxID?: string }>(
      `${baseUrl}/tokenized/checkout/payment/status`,
      { paymentID: paymentId },
      { headers, timeout: 10000 },
    )

    return response.data
  }

  async refund(data: {
    paymentId: string
    trxId: string
    amount: number
    reason: string
    sku: string
    invoiceNumber?: string
    storeId?: string
  }): Promise<{ transactionStatus: string; refundTrxID: string }> {
    const { storeId, creds } = await this.getCredentials(data.storeId, data.invoiceNumber)
    const headers = await this.getAuthHeaders(creds, storeId)
    const baseUrl = this.baseUrl(creds)

    const response = await axios.post<{ transactionStatus: string; refundTrxID: string }>(
      `${baseUrl}/tokenized/checkout/payment/refund`,
      {
        paymentID: data.paymentId,
        trxID: data.trxId,
        amount: data.amount.toFixed(2),
        reason: data.reason,
        sku: data.sku,
      },
      { headers, timeout: 15000 },
    )

    return response.data
  }
}
