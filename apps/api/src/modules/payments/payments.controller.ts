import { BadRequestException, Body, Controller, Get, Logger, Optional, Post, Query, Res } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { Response } from 'express'
import { Public } from '../../common/auth/public.decorator'
import { assertGatewayEnabled, loadStorePaymentFlags } from '../../common/payment-flags.util'
import { PrismaService } from '../../common/prisma.service'
import { OrderEventsService } from '../orders/order-events.service'
import { CourierService } from '../courier/courier.service'
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
    @Optional() private readonly courier: CourierService | null,
  ) {}

  // ── bKash ─────────────────────────────────────────────────

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('bkash/create')
  async createBkashPayment(
    @Body() body: { amount: number; invoiceNumber: string; callbackUrl: string },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { invoiceNumber: body.invoiceNumber },
      select: { total: true, status: true, paymentStatus: true, storeId: true },
    })
    if (!order) throw new BadRequestException('Order not found for this invoice')
    const flags = await loadStorePaymentFlags(this.prisma, order.storeId)
    assertGatewayEnabled('bkash', flags)
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      throw new BadRequestException('This order is no longer payable')
    }
    if (order.paymentStatus === 'PAID') {
      throw new BadRequestException('This order is already paid')
    }
    if (Math.abs(Number(body.amount) - Number(order.total)) > 1) {
      throw new BadRequestException('Payment amount does not match the order total')
    }
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
    const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://splaro.co'
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

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('nagad/init')
  async initNagadPayment(@Body() body: { orderId: string; amount: number; callbackUrl: string }) {
    const order = await this.prisma.order.findUnique({
      where: { id: body.orderId },
      select: { storeId: true, total: true, status: true, paymentStatus: true },
    })
    if (!order) throw new BadRequestException('Order not found')
    const flags = await loadStorePaymentFlags(this.prisma, order.storeId)
    assertGatewayEnabled('nagad', flags)
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      throw new BadRequestException('This order is no longer payable')
    }
    if (order.paymentStatus === 'PAID') {
      throw new BadRequestException('This order is already paid')
    }
    if (Math.abs(Number(body.amount) - Number(order.total)) > 1) {
      throw new BadRequestException('Payment amount does not match the order total')
    }
    return this.nagad.initPayment(body)
  }

  @Public()
  @Get('nagad/verify')
  async nagadCallback(
    @Query('paymentRefId') paymentRefId: string,
    @Query('orderId') orderId: string,
    @Res() res: Response,
  ) {
    const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://splaro.co'
    try {
      const result = await this.nagad.verifyPayment(paymentRefId, orderId)
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
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('ssl/init')
  async initSslPayment(
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
    const order = await this.prisma.order.findUnique({
      where: { invoiceNumber: body.invoiceNumber },
      select: { storeId: true, total: true, status: true, paymentStatus: true },
    })
    if (!order) throw new BadRequestException('Order not found for this invoice')
    const flags = await loadStorePaymentFlags(this.prisma, order.storeId)
    assertGatewayEnabled('sslcommerz', flags)
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      throw new BadRequestException('This order is no longer payable')
    }
    if (order.paymentStatus === 'PAID') {
      throw new BadRequestException('This order is already paid')
    }
    if (Math.abs(Number(body.amount) - Number(order.total)) > 1) {
      throw new BadRequestException('Payment amount does not match the order total')
    }
    return this.ssl.initPayment(body)
  }

  @Public()
  @Post('ssl/success')
  async sslSuccess(@Body() body: SslCommerzIpnPayload, @Res() res: Response) {
    const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://splaro.co'
    const result = await this.ssl.handleCallback(body, 'success')
    if (result.ok) void this.firePaymentEvent(result.invoiceNumber)
    return res.redirect(`${siteUrl}/payment/${result.ok ? 'success' : 'failed'}?invoice=${result.invoiceNumber}`)
  }

  @Public()
  @Post('ssl/fail')
  sslFail(@Body() body: SslCommerzIpnPayload, @Res() res: Response) {
    const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://splaro.co'
    void this.ssl.handleCallback(body, 'fail')
    return res.redirect(`${siteUrl}/payment/failed?invoice=${body.tran_id}`)
  }

  @Public()
  @Post('ssl/cancel')
  sslCancel(@Body() body: SslCommerzIpnPayload, @Res() res: Response) {
    const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://splaro.co'
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
      select: { id: true, storeId: true, total: true, status: true, paymentStatus: true },
    })
    if (!order) return

    // Idempotency: a duplicate/late callback must not re-confirm or overwrite
    // the transaction id of an already-paid order.
    if (order.paymentStatus === 'PAID') {
      this.logger.warn(`${gateway} callback for already-paid order ${invoiceNumber} ignored (TxID: ${transactionId})`)
      return
    }

    // A cancelled/refunded order must never flip back to CONFIRMED because a
    // stale gateway callback arrived. Record the event for manual reconciliation.
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      this.logger.error(
        `${gateway} payment received for ${order.status} order ${invoiceNumber} (TxID: ${transactionId}, amount: ${amount}) — needs manual refund`,
      )
      await this.prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: order.status,
          note: `${gateway} payment of ${amount} received AFTER ${order.status} (TxID: ${transactionId}) — manual refund required`,
        },
      })
      return
    }

    // Underpayment guard: the paid amount must cover the order total.
    if (Number(amount) + 1 < Number(order.total)) {
      this.logger.error(
        `${gateway} underpayment for ${invoiceNumber}: paid ${amount}, order total ${Number(order.total)} (TxID: ${transactionId}) — order NOT confirmed`,
      )
      await this.prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: order.status,
          note: `${gateway} paid ${amount} of ${Number(order.total)} (TxID: ${transactionId}) — amount mismatch, order not confirmed`,
        },
      })
      return
    }

    const existingPayment = await this.prisma.payment.findFirst({ where: { orderId: order.id } })
    const method = gateway.toUpperCase() as 'BKASH' | 'NAGAD' | 'SSLCOMMERZ'

    await this.prisma.$transaction([
      existingPayment
        ? this.prisma.payment.update({
            where: { id: existingPayment.id },
            data: { status: 'PAID', method, amount, transactionId, paidAt: new Date() },
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

    // Prepaid orders skip auto courier booking at placement; book now that
    // the payment is verified.
    if (process.env.AUTO_COURIER_BOOK !== 'false') {
      void this.courier
        ?.bookCourier(order.id)
        .catch((err) =>
          this.logger.error(
            `Auto courier booking after ${gateway} payment failed for ${invoiceNumber}: ${err instanceof Error ? err.message : 'unknown'}`,
          ),
        )
    }
  }

  private async firePaymentEvent(invoiceNumber: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { invoiceNumber },
      select: {
        id: true,
        storeId: true,
        total: true,
        paymentStatus: true,
        courier: { select: { consignmentId: true } },
      },
    })
    if (!order) return

    void this.orderEvents.onPaymentReceived(order.storeId, order.id, Number(order.total), 'sslcommerz')

    if (
      order.paymentStatus === 'PAID' &&
      !order.courier?.consignmentId &&
      process.env.AUTO_COURIER_BOOK !== 'false'
    ) {
      void this.courier
        ?.bookCourier(order.id)
        .catch((err) =>
          this.logger.error(
            `Auto courier booking after SSLCommerz payment failed for ${invoiceNumber}: ${err instanceof Error ? err.message : 'unknown'}`,
          ),
        )
    }
  }
}
