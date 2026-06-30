import { BadRequestException, Body, Controller, Get, Logger, Post, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { Public } from '../../common/auth/public.decorator'
import { PrismaService } from '../../common/prisma.service'
import { OrderEventsService } from '../orders/order-events.service'
import { BkashService } from './bkash.service'
import { NagadService } from './nagad.service'
import { SslCommerzService, type SslCommerzIpnPayload } from './sslcommerz.service'

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name)

  constructor(
    private readonly bkash: BkashService,
    private readonly nagad: NagadService,
    private readonly ssl: SslCommerzService,
    private readonly prisma: PrismaService,
    private readonly orderEvents: OrderEventsService,
  ) {}

  // ── bKash ─────────────────────────────────────────────────

  @Public()
  @Post('bkash/create')
  createBkashPayment(@Body() body: { amount: number; invoiceNumber: string; callbackUrl: string }) {
    return this.bkash.createPayment(body)
  }

  @Public()
  @Post('bkash/execute')
  executeBkashPayment(@Body('paymentId') paymentId: string) {
    return this.bkash.executePayment(paymentId)
  }

  @Public()
  @Get('bkash/query')
  queryBkashPayment(@Query('paymentId') paymentId: string) {
    return this.bkash.queryPayment(paymentId)
  }

  @Post('bkash/refund')
  refundBkash(
    @Body() body: { paymentId: string; trxId: string; amount: number; reason: string; sku?: string },
  ) {
    return this.bkash.refund({
      paymentId: body.paymentId,
      trxId: body.trxId,
      amount: body.amount,
      reason: body.reason,
      sku: body.sku ?? 'SPLARO',
    })
  }

  @Public()
  @Get('bkash/callback')
  async bkashCallback(
    @Query('paymentID') paymentID: string,
    @Query('status') status: string,
    @Res() res: Response,
  ) {
    const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://splaro.com.bd'
    try {
      if (status === 'success' && paymentID) {
        const result = await this.bkash.executePayment(paymentID)
        const invoiceNumber = result.merchantInvoiceNumber
        const paid = result.transactionStatus === 'Completed'
        if (paid && invoiceNumber) {
          await this.confirmOrderPayment(invoiceNumber, 'bkash', result.trxID, Number(result.amount))
        }
        return res.redirect(`${siteUrl}/payment/${paid ? 'success' : 'failed'}?invoice=${invoiceNumber}`)
      }
      return res.redirect(`${siteUrl}/payment/failed?reason=${encodeURIComponent(status ?? 'unknown')}`)
    } catch (err) {
      this.logger.error(`bKash callback error: ${err instanceof Error ? err.message : 'unknown'}`)
      return res.redirect(`${siteUrl}/payment/failed`)
    }
  }

  // ── Nagad ─────────────────────────────────────────────────

  @Public()
  @Post('nagad/init')
  initNagadPayment(@Body() body: { orderId: string; amount: number; callbackUrl: string }) {
    return this.nagad.initPayment(body)
  }

  @Public()
  @Get('nagad/verify')
  async nagadCallback(
    @Query('paymentRefId') paymentRefId: string,
    @Query('orderId') orderId: string,
    @Res() res: Response,
  ) {
    const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://splaro.com.bd'
    try {
      const result = await this.nagad.verifyPayment(paymentRefId)
      const paid = result.status === 'Success'
      if (paid && orderId) {
        const order = await this.prisma.order.findUnique({
          where: { id: orderId },
          select: { invoiceNumber: true, total: true },
        })
        if (order) {
          await this.confirmOrderPayment(order.invoiceNumber, 'nagad', paymentRefId, Number(order.total))
        }
      }
      return res.redirect(`${siteUrl}/payment/${paid ? 'success' : 'failed'}?ref=${paymentRefId}`)
    } catch (err) {
      this.logger.error(`Nagad callback error: ${err instanceof Error ? err.message : 'unknown'}`)
      return res.redirect(`${siteUrl}/payment/failed`)
    }
  }

  // ── SSLCommerz ────────────────────────────────────────────

  @Public()
  @Post('ssl/init')
  initSslPayment(
    @Body()
    body: {
      invoiceNumber: string
      amount: number
      customerName: string
      customerEmail: string
      customerPhone: string
      customerAddress: string
      customerCity: string
      successUrl: string
      failUrl: string
      cancelUrl: string
    },
  ) {
    return this.ssl.initPayment(body)
  }

  @Public()
  @Post('ssl/success')
  async sslSuccess(@Body() body: SslCommerzIpnPayload, @Res() res: Response) {
    const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://splaro.com.bd'
    const result = await this.ssl.handleCallback(body, 'success')
    if (result.ok) void this.firePaymentEvent(result.invoiceNumber)
    return res.redirect(`${siteUrl}/payment/${result.ok ? 'success' : 'failed'}?invoice=${result.invoiceNumber}`)
  }

  @Public()
  @Post('ssl/fail')
  sslFail(@Body() body: SslCommerzIpnPayload, @Res() res: Response) {
    const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://splaro.com.bd'
    void this.ssl.handleCallback(body, 'fail')
    return res.redirect(`${siteUrl}/payment/failed?invoice=${body.tran_id}`)
  }

  @Public()
  @Post('ssl/cancel')
  sslCancel(@Body() body: SslCommerzIpnPayload, @Res() res: Response) {
    const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://splaro.com.bd'
    void this.ssl.handleCallback(body, 'cancel')
    return res.redirect(`${siteUrl}/payment/cancelled?invoice=${body.tran_id}`)
  }

  @Public()
  @Post('ssl/ipn')
  async sslIpn(@Body() body: SslCommerzIpnPayload) {
    const result = await this.ssl.handleCallback(body, 'ipn')
    if (result.ok) void this.firePaymentEvent(result.invoiceNumber)
    return { received: true, status: result.status }
  }

  // ── Helpers ───────────────────────────────────────────────

  private async confirmOrderPayment(
    invoiceNumber: string,
    gateway: string,
    transactionId: string,
    amount: number,
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { invoiceNumber },
      select: { id: true, storeId: true },
    })
    if (!order) return

    const existingPayment = await this.prisma.payment.findFirst({ where: { orderId: order.id } })
    const method = gateway.toUpperCase() as 'BKASH' | 'NAGAD' | 'SSLCOMMERZ'

    await this.prisma.$transaction([
      existingPayment
        ? this.prisma.payment.update({
            where: { id: existingPayment.id },
            data: { status: 'PAID', transactionId },
          })
        : this.prisma.payment.create({
            data: {
              orderId: order.id,
              method,
              status: 'PAID',
              amount,
              currency: 'BDT',
              transactionId,
              paidAt: new Date(),
            },
          }),
      this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'CONFIRMED', paymentStatus: 'PAID' },
      }),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: 'CONFIRMED',
          note: `${gateway} payment confirmed. TxID: ${transactionId}`,
        },
      }),
    ])

    void this.orderEvents.onPaymentReceived(order.storeId, order.id, amount, gateway)
    void this.orderEvents.onStatusChanged(order.storeId, order.id, 'CONFIRMED')
  }

  private async firePaymentEvent(invoiceNumber: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { invoiceNumber },
      select: { id: true, storeId: true, total: true },
    })
    if (order) {
      void this.orderEvents.onPaymentReceived(order.storeId, order.id, Number(order.total), 'sslcommerz')
    }
  }
}
