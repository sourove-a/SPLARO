import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../common/prisma.service'
import { createHash } from 'crypto'

export interface SslCommerzInitPayload {
  invoiceNumber: string
  amount: number
  currency?: string
  customerName: string
  customerEmail: string
  customerPhone: string
  customerAddress: string
  customerCity: string
  successUrl: string
  failUrl: string
  cancelUrl: string
  storeId?: string
}

export interface SslCommerzInitResponse {
  gatewayUrl: string
  sessionKey: string
  status: string
}

export interface SslCommerzIpnPayload {
  tran_id: string
  val_id?: string
  amount: string
  card_type?: string
  store_amount?: string
  card_no?: string
  bank_tran_id?: string
  status: string
  tran_date?: string
  error?: string
  currency?: string
  card_issuer?: string
  card_brand?: string
  verify_sign?: string
  verify_key?: string
}

@Injectable()
export class SslCommerzService {
  private readonly logger = new Logger(SslCommerzService.name)
  private readonly baseUrl: string
  private readonly storeId: string
  private readonly storePassword: string
  private readonly isSandbox: boolean

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.isSandbox = this.config.get<string>('SSLCOMMERZ_SANDBOX') === 'true'
    this.baseUrl = this.isSandbox
      ? 'https://sandbox.sslcommerz.com'
      : 'https://securepay.sslcommerz.com'
    this.storeId = this.config.get<string>('SSLCOMMERZ_STORE_ID') ?? ''
    this.storePassword = this.config.get<string>('SSLCOMMERZ_STORE_PASSWORD') ?? ''
  }

  async initPayment(payload: SslCommerzInitPayload): Promise<SslCommerzInitResponse> {
    if (!this.storeId || !this.storePassword) {
      throw new Error('SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD not configured')
    }

    const params = new URLSearchParams({
      store_id: this.storeId,
      store_passwd: this.storePassword,
      total_amount: payload.amount.toFixed(2),
      currency: payload.currency ?? 'BDT',
      tran_id: payload.invoiceNumber,
      success_url: payload.successUrl,
      fail_url: payload.failUrl,
      cancel_url: payload.cancelUrl,
      cus_name: payload.customerName,
      cus_email: payload.customerEmail,
      cus_phone: payload.customerPhone,
      cus_add1: payload.customerAddress,
      cus_city: payload.customerCity,
      cus_country: 'Bangladesh',
      shipping_method: 'NO',
      product_name: 'SPLARO Order',
      product_category: 'Fashion',
      product_profile: 'general',
    })

    const res = await fetch(`${this.baseUrl}/gwprocess/v4/api.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) throw new Error(`SSLCommerz init failed: HTTP ${res.status}`)

    const data = (await res.json()) as {
      status: string
      GatewayPageURL?: string
      sessionkey?: string
      failedreason?: string
    }

    if (data.status !== 'SUCCESS' || !data.GatewayPageURL) {
      throw new Error(data.failedreason ?? 'SSLCommerz init failed')
    }

    return {
      gatewayUrl: data.GatewayPageURL,
      sessionKey: data.sessionkey ?? '',
      status: data.status,
    }
  }

  async validateIpn(body: SslCommerzIpnPayload): Promise<boolean> {
    if (!body.val_id || body.status !== 'VALID') return false

    const res = await fetch(
      `${this.baseUrl}/validator/api/validationserverAPI.php?val_id=${body.val_id}&store_id=${this.storeId}&store_passwd=${this.storePassword}&format=json`,
      { signal: AbortSignal.timeout(10_000) },
    )

    if (!res.ok) return false
    const data = (await res.json()) as { status?: string; tran_id?: string; amount?: string }
    return data.status === 'VALID' && data.tran_id === body.tran_id
  }

  verifyHash(body: SslCommerzIpnPayload): boolean {
    if (!body.verify_sign || !body.verify_key) return true
    const keys = body.verify_key.split(',')
    const parts: string[] = []
    for (const key of keys) {
      if (key === 'store_passwd') {
        parts.push(`${key}=${createHash('md5').update(this.storePassword).digest('hex')}`)
      } else {
        parts.push(`${key}=${((body as unknown) as Record<string, string>)[key] ?? ''}`)
      }
    }
    const computed = createHash('md5').update(parts.join('&')).digest('hex')
    return computed === body.verify_sign
  }

  async handleCallback(
    body: SslCommerzIpnPayload,
    type: 'success' | 'fail' | 'cancel' | 'ipn',
  ): Promise<{ ok: boolean; invoiceNumber: string; status: string }> {
    const invoiceNumber = body.tran_id
    const paymentStatus = type === 'success' ? 'PAID' : type === 'fail' ? 'FAILED' : 'CANCELLED'

    if (type === 'success' || type === 'ipn') {
      const valid = await this.validateIpn(body)
      if (!valid) {
        this.logger.warn(`SSLCommerz IPN validation failed for ${invoiceNumber}`)
        return { ok: false, invoiceNumber, status: 'INVALID' }
      }
    }

    await this.updateOrderPayment(invoiceNumber, paymentStatus, body)
    return { ok: true, invoiceNumber, status: paymentStatus }
  }

  private async updateOrderPayment(
    invoiceNumber: string,
    status: string,
    body: SslCommerzIpnPayload,
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { invoiceNumber },
      select: { id: true, storeId: true },
    })
    if (!order) {
      this.logger.warn(`SSLCommerz callback: order ${invoiceNumber} not found`)
      return
    }

    const existing = await this.prisma.payment.findFirst({ where: { orderId: order.id } })
    const txId = body.bank_tran_id ?? body.val_id ?? ''
    const dbStatus = (status === 'PAID' ? 'PAID' : status === 'FAILED' ? 'FAILED' : 'PENDING') as never

    await this.prisma.$transaction([
      existing
        ? this.prisma.payment.update({
            where: { id: existing.id },
            data: {
              status: dbStatus,
              transactionId: txId,
              gatewayResponse: body as never,
              ...(status === 'PAID' ? { paidAt: new Date() } : {}),
            },
          })
        : this.prisma.payment.create({
            data: {
              orderId: order.id,
              method: 'SSLCOMMERZ',
              status: dbStatus,
              amount: parseFloat(body.amount ?? '0'),
              currency: body.currency ?? 'BDT',
              transactionId: txId,
              gatewayResponse: body as never,
              ...(status === 'PAID' ? { paidAt: new Date() } : {}),
            },
          }),
      ...(status === 'PAID'
        ? [
            this.prisma.order.update({
              where: { id: order.id },
              data: { status: 'CONFIRMED', paymentStatus: 'PAID' },
            }),
            this.prisma.orderStatusHistory.create({
              data: { orderId: order.id, status: 'CONFIRMED', note: 'SSLCommerz payment confirmed' },
            }),
          ]
        : []),
    ])

    this.logger.log(`SSLCommerz payment ${status} for order ${invoiceNumber}`)
  }
}
