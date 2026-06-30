import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'

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

@Injectable()
export class BkashService {
  private readonly logger = new Logger(BkashService.name)
  private readonly baseUrl: string
  private token: string | null = null
  private tokenExpiry: Date | null = null

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    const sandbox = this.config.get<string>('BKASH_SANDBOX') === 'true'
    this.baseUrl = sandbox
      ? 'https://tokenized.sandbox.bka.sh/v1.2.0-beta'
      : 'https://tokenized.pay.bka.sh/v1.2.0-beta'
  }

  private get credentials() {
    return {
      appKey: this.config.get<string>('BKASH_APP_KEY') ?? '',
      appSecret: this.config.get<string>('BKASH_APP_SECRET') ?? '',
      username: this.config.get<string>('BKASH_USERNAME') ?? '',
      password: this.config.get<string>('BKASH_PASSWORD') ?? '',
    }
  }

  private async getToken(): Promise<string> {
    if (this.token && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.token
    }

    const { appKey, appSecret, username, password } = this.credentials

    const response = await axios.post<BkashTokenResponse>(
      `${this.baseUrl}/tokenized/checkout/token/grant`,
      { app_key: appKey, app_secret: appSecret },
      {
        headers: {
          username,
          password,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      },
    )

    this.token = response.data.id_token
    this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 60) * 1000)
    return this.token
  }

  private async getAuthHeaders() {
    const { appKey } = this.credentials
    const token = await this.getToken()
    return {
      Authorization: token,
      'X-APP-Key': appKey,
      'Content-Type': 'application/json',
    }
  }

  async createPayment(data: {
    amount: number
    invoiceNumber: string
    callbackUrl: string
  }): Promise<BkashCreatePaymentResponse> {
    const headers = await this.getAuthHeaders()

    const response = await axios.post<BkashCreatePaymentResponse>(
      `${this.baseUrl}/tokenized/checkout/create`,
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

  async executePayment(paymentId: string): Promise<BkashExecuteResponse> {
    const headers = await this.getAuthHeaders()

    const response = await axios.post<BkashExecuteResponse>(
      `${this.baseUrl}/tokenized/checkout/execute`,
      { paymentID: paymentId },
      { headers, timeout: 15000 },
    )

    this.logger.log(`bKash payment executed: ${response.data.trxID} — status: ${response.data.transactionStatus}`)
    return response.data
  }

  async queryPayment(paymentId: string): Promise<{ transactionStatus: string; trxID?: string }> {
    const headers = await this.getAuthHeaders()

    const response = await axios.post<{ transactionStatus: string; trxID?: string }>(
      `${this.baseUrl}/tokenized/checkout/payment/status`,
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
  }): Promise<{ transactionStatus: string; refundTrxID: string }> {
    const headers = await this.getAuthHeaders()

    const response = await axios.post<{ transactionStatus: string; refundTrxID: string }>(
      `${this.baseUrl}/tokenized/checkout/payment/refund`,
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
