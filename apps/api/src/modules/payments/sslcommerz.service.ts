import { Injectable, Logger } from '@nestjs/common'
import { createHash } from 'crypto'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { PaymentIntegrationService } from '../integrations/payment-integration.service'

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

type SslRuntime = Awaited<ReturnType<PaymentIntegrationService['resolveRuntimeCredentials']>>

@Injectable()
export class SslCommerzService {
  private readonly logger = new Logger(SslCommerzService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentIntegration: PaymentIntegrationService,
  ) {}

  private baseUrl(creds: SslRuntime): string {
    return creds.sandbox ? 'https://sandbox.sslcommerz.com' : 'https://securepay.sslcommerz.com'
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
    const creds = await this.paymentIntegration.resolveRuntimeCredentials(storeId, 'sslcommerz')
    if (!creds.storeId || !creds.storePassword) {
      throw new Error('SSLCommerz credentials are not configured — save keys in Admin → Settings → Payments')
    }
    return { storeId, creds }
  }

  async initPayment(payload: SslCommerzInitPayload): Promise<SslCommerzInitResponse> {
    const { creds } = await this.getCredentials(payload.storeId, payload.invoiceNumber)
    const baseUrl = this.baseUrl(creds)

    const params = new URLSearchParams({
      store_id: creds.storeId!,
      store_passwd: creds.storePassword!,
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

    const res = await fetch(`${baseUrl}/gwprocess/v4/api.php`, {
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

  async validateIpn(body: SslCommerzIpnPayload, invoiceNumber?: string): Promise<boolean> {
    if (!body.val_id || body.status !== 'VALID') return false

    const { creds } = await this.getCredentials(undefined, invoiceNumber ?? body.tran_id)
    const baseUrl = this.baseUrl(creds)

    const res = await fetch(
      `${baseUrl}/validator/api/validationserverAPI.php?val_id=${body.val_id}&store_id=${creds.storeId}&store_passwd=${creds.storePassword}&format=json`,
      { signal: AbortSignal.timeout(10_000) },
    )

    if (!res.ok) return false
    const data = (await res.json()) as { status?: string; tran_id?: string; amount?: string }
    return data.status === 'VALID' && data.tran_id === body.tran_id
  }

  async verifyHash(body: SslCommerzIpnPayload, invoiceNumber?: string): Promise<boolean> {
    if (!body.verify_sign || !body.verify_key) return true
    const { creds } = await this.getCredentials(undefined, invoiceNumber ?? body.tran_id)
    const keys = body.verify_key.split(',')
    const parts: string[] = []
    for (const key of keys) {
      if (key === 'store_passwd') {
        parts.push(`${key}=${createHash('md5').update(creds.storePassword!).digest('hex')}`)
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
      const valid = await this.validateIpn(body, invoiceNumber)
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
