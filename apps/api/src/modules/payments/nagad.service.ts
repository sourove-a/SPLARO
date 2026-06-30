import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import * as crypto from 'crypto'

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

@Injectable()
export class NagadService {
  private readonly logger = new Logger(NagadService.name)
  private readonly baseUrl: string

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    const sandbox = this.config.get<string>('NAGAD_SANDBOX') === 'true'
    this.baseUrl = sandbox
      ? 'https://sandbox.mynagad.com:10080/remote-payment-gateway-1.0'
      : 'https://api.mynagad.com/api/dfs'
  }

  private get credentials() {
    return {
      merchantId: this.config.get<string>('NAGAD_MERCHANT_ID') ?? '',
      merchantNumber: this.config.get<string>('NAGAD_MERCHANT_NUMBER') ?? '',
      publicKey: this.config.get<string>('NAGAD_PUBLIC_KEY') ?? '',
      privateKey: this.config.get<string>('NAGAD_PRIVATE_KEY') ?? '',
    }
  }

  private encryptWithPublicKey(data: string): string {
    const { publicKey } = this.credentials
    const buffer = Buffer.from(data)
    const encrypted = crypto.publicEncrypt(
      { key: `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`, padding: crypto.constants.RSA_PKCS1_PADDING },
      buffer,
    )
    return encrypted.toString('base64')
  }

  private signWithPrivateKey(data: string): string {
    const { privateKey } = this.credentials
    const sign = crypto.createSign('SHA256WithRSA')
    sign.update(data)
    return sign.sign(`-----BEGIN RSA PRIVATE KEY-----\n${privateKey}\n-----END RSA PRIVATE KEY-----`, 'base64')
  }

  async initPayment(data: {
    orderId: string
    amount: number
    callbackUrl: string
  }): Promise<{ url: string; paymentRefId: string }> {
    const { merchantId, merchantNumber } = this.credentials
    const datetime = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)

    const sensitiveData = this.encryptWithPublicKey(
      JSON.stringify({
        merchantId,
        datetime,
        orderId: data.orderId,
        challenge: crypto.randomBytes(16).toString('hex'),
      }),
    )

    const signature = this.signWithPrivateKey(sensitiveData)

    const initResponse = await axios.post<NagadInitResponse>(
      `${this.baseUrl}/bill-payment/init/${merchantId}/${data.orderId}`,
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
      { key: `-----BEGIN RSA PRIVATE KEY-----\n${this.credentials.privateKey}\n-----END RSA PRIVATE KEY-----`, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(initResponse.data.sensitiveData, 'base64'),
    ).toString()

    const decrypted: NagadDecryptedData = JSON.parse(decryptedRaw)

    const paymentSensitiveData = this.encryptWithPublicKey(
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
      `${this.baseUrl}/bill-payment/complete/${merchantId}/${data.orderId}`,
      {
        sensitiveData: paymentSensitiveData,
        signature: this.signWithPrivateKey(paymentSensitiveData),
        merchantCallbackURL: data.callbackUrl,
        additionalMerchantInfo: {},
      },
      {
        headers: { 'X-KM-IP-V4': '127.0.0.1', 'X-KM-MC-Id': merchantId },
        timeout: 15000,
      },
    )

    this.logger.log(`Nagad payment initiated for order ${data.orderId}`)
    return {
      url: completeResponse.data.callBackUrl,
      paymentRefId: completeResponse.data.paymentReferenceId,
    }
  }

  async verifyPayment(paymentRefId: string): Promise<NagadCompleteResponse> {
    const { merchantId } = this.credentials

    const response = await axios.get<NagadCompleteResponse>(
      `${this.baseUrl}/bill-payment/verify/${merchantId}/${paymentRefId}`,
      {
        headers: { 'X-KM-IP-V4': '127.0.0.1', 'X-KM-MC-Id': merchantId },
        timeout: 10000,
      },
    )

    this.logger.log(`Nagad payment verified: ${paymentRefId} — ${response.data.status}`)
    return response.data
  }
}
