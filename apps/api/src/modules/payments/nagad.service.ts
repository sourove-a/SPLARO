import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import * as crypto from 'crypto'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { PaymentIntegrationService } from '../integrations/payment-integration.service'

interface NagadInitResponse {
  sensitiveData: string
  signature: string
  callBackUrl: string
  orderId: string
}

interface NagadDecryptedData {
  paymentReferenceId: string
  challenge: string
}

export interface NagadCompleteResponse {
  paymentRefId: string
  orderId: string
  amount: string
  clientMobileNo: string
  merchantId: string
  orderDateTime: string
  issuerPaymentDateTime: string
  issuerPaymentRefNo: string
  additionalMerchantInfo: string
  status: string
  statusCode: string
  statusMessage: string
}

type NagadRuntime = Awaited<ReturnType<PaymentIntegrationService['resolveRuntimeCredentials']>>

@Injectable()
export class NagadService {
  private readonly logger = new Logger(NagadService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentIntegration: PaymentIntegrationService,
  ) {}

  private baseUrl(creds: NagadRuntime): string {
    return creds.sandbox
      ? 'https://sandbox.mynagad.com:10080/remote-payment-gateway-1.0'
      : 'https://api.mynagad.com/api/dfs'
  }

  private async resolveStoreId(storeIdOrSlug?: string, orderId?: string): Promise<string> {
    if (storeIdOrSlug) return resolveStoreId(this.prisma, storeIdOrSlug)
    if (orderId) {
      const order = await this.prisma.order.findFirst({
        where: { OR: [{ id: orderId }, { invoiceNumber: orderId }] },
        select: { storeId: true },
      })
      if (order) return order.storeId
    }
    return resolveStoreId(this.prisma)
  }

  private async getCredentials(storeIdOrSlug?: string, orderId?: string) {
    const storeId = await this.resolveStoreId(storeIdOrSlug, orderId)
    const creds = await this.paymentIntegration.resolveRuntimeCredentials(storeId, 'nagad')
    if (!creds.merchantId || !creds.publicKey || !creds.privateKey) {
      throw new Error('Nagad credentials are not configured — save keys in Admin → Settings → Payments')
    }
    return { storeId, creds }
  }

  private encryptWithPublicKey(publicKey: string, data: string): string {
    const buffer = Buffer.from(data)
    const encrypted = crypto.publicEncrypt(
      { key: `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`, padding: crypto.constants.RSA_PKCS1_PADDING },
      buffer,
    )
    return encrypted.toString('base64')
  }

  private signWithPrivateKey(privateKey: string, data: string): string {
    const sign = crypto.createSign('SHA256WithRSA')
    sign.update(data)
    return sign.sign(`-----BEGIN RSA PRIVATE KEY-----\n${privateKey}\n-----END RSA PRIVATE KEY-----`, 'base64')
  }

  async initPayment(data: {
    orderId: string
    amount: number
    callbackUrl: string
    storeId?: string
  }): Promise<{ url: string; paymentRefId: string }> {
    const { creds } = await this.getCredentials(data.storeId, data.orderId)
    const baseUrl = this.baseUrl(creds)
    const { merchantId, merchantNumber, publicKey, privateKey } = creds
    const datetime = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)

    const sensitiveData = this.encryptWithPublicKey(
      publicKey,
      JSON.stringify({
        merchantId,
        datetime,
        orderId: data.orderId,
        challenge: crypto.randomBytes(16).toString('hex'),
      }),
    )

    const signature = this.signWithPrivateKey(privateKey, sensitiveData)

    const initResponse = await axios.post<NagadInitResponse>(
      `${baseUrl}/bill-payment/init/${merchantId}/${data.orderId}`,
      {
        accountNumber: merchantNumber,
        datetime,
        sensitiveData,
        signature,
      },
      {
        headers: { 'X-KM-IP-V4': '127.0.0.1', 'X-KM-MC-Id': merchantId },
        timeout: 15000,
      },
    )

    const decryptedRaw = crypto.privateDecrypt(
      { key: `-----BEGIN RSA PRIVATE KEY-----\n${privateKey}\n-----END RSA PRIVATE KEY-----`, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(initResponse.data.sensitiveData, 'base64'),
    ).toString()

    const decrypted: NagadDecryptedData = JSON.parse(decryptedRaw)

    const paymentSensitiveData = this.encryptWithPublicKey(
      publicKey,
      JSON.stringify({
        merchantId,
        orderId: data.orderId,
        challenge: decrypted.challenge,
        amount: data.amount.toFixed(2),
        currencyCode: '050',
        orderDateTime: datetime,
        additionalMerchantInfo: { Service: 'Fashion eCommerce', Type: 'Online' },
      }),
    )

    const completeResponse = await axios.post<{ callBackUrl: string; paymentReferenceId: string }>(
      `${baseUrl}/bill-payment/complete/${merchantId}/${data.orderId}`,
      {
        sensitiveData: paymentSensitiveData,
        signature: this.signWithPrivateKey(privateKey, paymentSensitiveData),
        merchantCallbackURL: data.callbackUrl,
        additionalMerchantInfo: {},
      },
      {
        headers: { 'X-KM-IP-V4': '127.0.0.1', 'X-KM-MC-Id': merchantId },
        timeout: 15000,
      },
    )

    this.logger.log(`Nagad payment initiated for reference ${data.orderId}`)
    return {
      url: completeResponse.data.callBackUrl,
      paymentRefId: completeResponse.data.paymentReferenceId,
    }
  }

  async verifyPayment(paymentRefId: string, orderId?: string): Promise<NagadCompleteResponse> {
    const { creds } = await this.getCredentials(undefined, orderId)
    const baseUrl = this.baseUrl(creds)
    const { merchantId } = creds

    const response = await axios.get<NagadCompleteResponse>(
      `${baseUrl}/bill-payment/verify/${merchantId}/${paymentRefId}`,
      {
        headers: { 'X-KM-IP-V4': '127.0.0.1', 'X-KM-MC-Id': merchantId },
        timeout: 10000,
      },
    )

    this.logger.log(`Nagad payment verified: ${paymentRefId} — ${response.data.status}`)
    return response.data
  }
}
