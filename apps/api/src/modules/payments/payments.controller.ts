import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Logger,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import {
  buildInvoiceAccessToken,
  resolveAllowedPaymentCallbackUrl,
  resolveCustomerFacingSiteUrl,
  verifyInvoiceAccessToken,
} from '@splaro/config'
import type { Prisma } from '@prisma/client'
import type { Response } from 'express'
import {
  BkashCreatePaymentDto,
  BkashExecutePaymentDto,
  BkashRefundDto,
  NagadInitPaymentDto,
  SslInitPaymentDto,
} from '../../common/dtos/payments.dto'
import { Public } from '../../common/auth/public.decorator'
import { assertGatewayEnabled, loadStorePaymentFlags } from '../../common/payment-flags.util'
import { paymentAmountMatches } from '../../common/payment-amount.util'
import { PrismaService } from '../../common/prisma.service'
import { BkashService } from './bkash.service'
import { NagadService } from './nagad.service'
import { PaymentConfirmationService } from './payment-confirmation.service'
import { SslCommerzService, type SslCommerzIpnPayload } from './sslcommerz.service'

interface PayableOrder {
  status: string
  paymentStatus: string
  total: Prisma.Decimal
}

function assertOrderPayable(order: PayableOrder, requestedAmount: number): void {
  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
    throw new BadRequestException('This order is no longer payable')
  }
  if (order.paymentStatus === 'PAID') {
    throw new BadRequestException('This order is already paid')
  }
  if (!paymentAmountMatches(requestedAmount, Number(order.total))) {
    throw new BadRequestException('Payment amount does not match the order total')
  }
}

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name)

  constructor(
    private readonly bkash: BkashService,
    private readonly nagad: NagadService,
    private readonly ssl: SslCommerzService,
    private readonly prisma: PrismaService,
    private readonly confirmation: PaymentConfirmationService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('status')
  async paymentStatus(@Query('invoiceNumber') invoiceNumber: string, @Query('key') key: string) {
    if (!invoiceNumber?.trim()) throw new BadRequestException('invoiceNumber is required')
    if (!key || !verifyInvoiceAccessToken(invoiceNumber.trim(), key)) {
      throw new ForbiddenException('Invalid payment status access key')
    }
    const order = await this.prisma.order.findUnique({
      where: { invoiceNumber: invoiceNumber.trim() },
      select: {
        invoiceNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        total: true,
        deliveryCharge: true,
        couponCode: true,
        items: {
          select: {
            productId: true,
            variantId: true,
            productName: true,
            variantName: true,
            price: true,
            quantity: true,
          },
        },
        payments: {
          where: { status: 'PAID' },
          select: { transactionId: true, paidAt: true },
          take: 1,
          orderBy: { paidAt: 'desc' },
        },
        updatedAt: true,
      },
    })
    if (!order) throw new BadRequestException('Order not found')
    const paidEvidence = order.payments.find((p) => Boolean(p.transactionId?.trim()))
    return {
      invoiceNumber: order.invoiceNumber,
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      // Verified only when a PAID Payment row carries a real reference — bare admin status flips do not count
      verified: order.paymentStatus === 'PAID' && Boolean(paidEvidence?.transactionId),
      total: Number(order.total),
      shipping: Number(order.deliveryCharge),
      coupon: order.couponCode,
      items: order.items.map((item) => ({
        id: item.variantId ?? item.productId,
        name: item.productName,
        price: Number(item.price),
        quantity: item.quantity,
        variant: item.variantName,
      })),
      updatedAt: order.updatedAt,
    }
  }

  // ── bKash ─────────────────────────────────────────────────

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('bkash/create')
  async createBkashPayment(@Body() body: BkashCreatePaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { invoiceNumber: body.invoiceNumber },
      select: { total: true, status: true, paymentStatus: true, storeId: true },
    })
    if (!order) throw new BadRequestException('Order not found for this invoice')
    const flags = await loadStorePaymentFlags(this.prisma, order.storeId)
    assertGatewayEnabled('bkash', flags)
    assertOrderPayable(order, Number(body.amount))
    const callbackUrl = resolveAllowedPaymentCallbackUrl(
      body.callbackUrl,
      '/payments/bkash/callback',
    )
    return this.bkash.createPayment({ ...body, callbackUrl })
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('bkash/execute')
  async executeBkashPayment(@Body() body: BkashExecutePaymentDto) {
    const result = await this.bkash.executePayment(body.paymentId)
    if (result.transactionStatus === 'Completed' && result.merchantInvoiceNumber && result.trxID) {
      await this.confirmation.confirm({
        invoiceNumber: result.merchantInvoiceNumber,
        method: 'BKASH',
        transactionId: result.trxID,
        amount: Number(result.amount),
        gatewayResponse: result as never,
      })
    }
    return result
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('bkash/query')
  queryBkashPayment(@Query('paymentId') paymentId: string) {
    if (!paymentId?.trim()) throw new BadRequestException('paymentId is required')
    return this.bkash.queryPayment(paymentId.trim())
  }

  @Post('bkash/refund')
  async refundBkash(@Body() body: BkashRefundDto) {
    // The gateway will happily refund whatever it is told to. Bound the request
    // against our own ledger first — a refund is irreversible once it lands.
    const payment = await this.prisma.payment.findUnique({
      where: { transactionId: body.trxId },
      select: { amount: true, refundAmount: true, status: true, method: true },
    })
    if (!payment) throw new BadRequestException('No payment found for this transaction')
    if (payment.method !== 'BKASH') {
      throw new BadRequestException('This transaction was not paid with bKash')
    }
    if (payment.status !== 'PAID') {
      throw new BadRequestException('Only a paid transaction can be refunded')
    }

    const alreadyRefunded = Number(payment.refundAmount ?? 0)
    const refundable = Number(payment.amount) - alreadyRefunded
    if (refundable <= 0) {
      throw new BadRequestException('This transaction is already fully refunded')
    }
    if (body.amount > refundable) {
      throw new BadRequestException(
        `Refund exceeds the refundable balance (${refundable.toFixed(2)})`,
      )
    }

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
    const siteUrl = resolveCustomerFacingSiteUrl()
    try {
      if (status === 'success' && paymentID) {
        const result = await this.bkash.executePayment(paymentID)
        const invoiceNumber = result.merchantInvoiceNumber
        const paid = result.transactionStatus === 'Completed'
        if (paid && invoiceNumber) {
          await this.confirmation.confirm({
            invoiceNumber,
            method: 'BKASH',
            transactionId: result.trxID,
            amount: Number(result.amount),
            gatewayResponse: result as never,
          })
        }
        const key = invoiceNumber ? buildInvoiceAccessToken(invoiceNumber) : ''
        return res.redirect(
          `${siteUrl}/payment/${paid ? 'success' : 'failed'}?invoice=${encodeURIComponent(invoiceNumber ?? '')}&key=${encodeURIComponent(key)}`,
        )
      }
      return res.redirect(
        `${siteUrl}/payment/failed?reason=${encodeURIComponent(status ?? 'unknown')}`,
      )
    } catch (err) {
      this.logger.error(`bKash callback error: ${err instanceof Error ? err.message : 'unknown'}`)
      return res.redirect(`${siteUrl}/payment/failed`)
    }
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('nagad/init')
  async initNagadPayment(@Body() body: NagadInitPaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { invoiceNumber: body.invoiceNumber },
      select: {
        storeId: true,
        total: true,
        status: true,
        paymentStatus: true,
        invoiceNumber: true,
      },
    })
    if (!order) throw new BadRequestException('Order not found')
    const flags = await loadStorePaymentFlags(this.prisma, order.storeId)
    assertGatewayEnabled('nagad', flags)
    assertOrderPayable(order, Number(body.amount))
    const callbackUrl = resolveAllowedPaymentCallbackUrl(
      body.callbackUrl,
      `/payments/nagad/verify?invoiceNumber=${encodeURIComponent(order.invoiceNumber)}`,
    )
    return this.nagad.initPayment({
      orderId: order.invoiceNumber,
      amount: body.amount,
      callbackUrl,
    })
  }

  @Public()
  @Get('nagad/verify')
  async nagadCallback(
    @Query('paymentRefId') paymentRefId: string,
    @Query('invoiceNumber') invoiceNumber: string,
    @Res() res: Response,
  ) {
    const siteUrl = resolveCustomerFacingSiteUrl()
    try {
      const order = await this.prisma.order.findUnique({
        where: { invoiceNumber },
        select: { invoiceNumber: true, total: true },
      })
      if (!order) throw new BadRequestException('Order not found')
      const result = await this.nagad.verifyPayment(paymentRefId, order.invoiceNumber)
      let confirmed = false

      if (result.status === 'Success') {
        if (result.orderId && result.orderId !== order.invoiceNumber) {
          this.logger.error(
            `Nagad orderId mismatch for ref ${paymentRefId}: gateway ${result.orderId}, expected ${order.invoiceNumber}`,
          )
        } else {
          const verifiedAmount = Number.parseFloat(result.amount ?? '')
          const expected = Number(order.total)
          if (!Number.isFinite(verifiedAmount)) {
            this.logger.error(
              `Nagad invalid amount for order ${order.invoiceNumber}: ${result.amount ?? 'missing'} (ref ${paymentRefId})`,
            )
          } else if (!paymentAmountMatches(verifiedAmount, expected)) {
            this.logger.error(
              `Nagad amount mismatch for order ${order.invoiceNumber}: paid ${verifiedAmount}, expected ${expected} (ref ${paymentRefId})`,
            )
          } else {
            await this.confirmation.confirm({
              invoiceNumber: order.invoiceNumber,
              method: 'NAGAD',
              transactionId: paymentRefId,
              amount: verifiedAmount,
              gatewayResponse: result as never,
            })
            confirmed = true
          }
        }
      }

      return res.redirect(
        `${siteUrl}/payment/${confirmed ? 'success' : 'failed'}?invoice=${encodeURIComponent(order.invoiceNumber)}&key=${encodeURIComponent(buildInvoiceAccessToken(order.invoiceNumber))}`,
      )
    } catch (err) {
      this.logger.error(`Nagad callback error: ${err instanceof Error ? err.message : 'unknown'}`)
      return res.redirect(`${siteUrl}/payment/failed`)
    }
  }

  // ── SSLCommerz ────────────────────────────────────────────

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('ssl/init')
  async initSslPayment(@Body() body: SslInitPaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { invoiceNumber: body.invoiceNumber },
      select: { storeId: true, total: true, status: true, paymentStatus: true },
    })
    if (!order) throw new BadRequestException('Order not found for this invoice')
    const flags = await loadStorePaymentFlags(this.prisma, order.storeId)
    assertGatewayEnabled('sslcommerz', flags)
    assertOrderPayable(order, Number(body.amount))
    return this.ssl.initPayment({
      ...body,
      successUrl: resolveAllowedPaymentCallbackUrl(body.successUrl, '/payments/ssl/success'),
      failUrl: resolveAllowedPaymentCallbackUrl(body.failUrl, '/payments/ssl/fail'),
      cancelUrl: resolveAllowedPaymentCallbackUrl(body.cancelUrl, '/payments/ssl/cancel'),
    })
  }

  @Public()
  @Post('ssl/success')
  async sslSuccess(@Body() body: SslCommerzIpnPayload, @Res() res: Response) {
    const siteUrl = resolveCustomerFacingSiteUrl()
    const result = await this.ssl.handleCallback(body, 'success')
    if (result.ok) {
      await this.confirmation.confirm({
        invoiceNumber: result.invoiceNumber,
        method: 'SSLCOMMERZ',
        transactionId: body.bank_tran_id ?? body.val_id ?? body.tran_id,
        amount: Number.parseFloat(body.amount),
        gatewayResponse: body as never,
      })
    }
    return res.redirect(
      `${siteUrl}/payment/${result.ok ? 'success' : 'failed'}?invoice=${encodeURIComponent(result.invoiceNumber)}&key=${encodeURIComponent(buildInvoiceAccessToken(result.invoiceNumber))}`,
    )
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('ssl/fail')
  async sslFail(@Body() body: SslCommerzIpnPayload, @Res() res: Response) {
    const siteUrl = resolveCustomerFacingSiteUrl()
    // Awaited, not `void` — an unhandled rejection here takes the process down.
    // The redirect must still happen even if the ledger write is rejected.
    try {
      await this.ssl.handleCallback(body, 'fail')
    } catch (err) {
      this.logger.error(`SSL fail callback error: ${err instanceof Error ? err.message : 'unknown'}`)
    }
    return res.redirect(
      `${siteUrl}/payment/failed?invoice=${encodeURIComponent(body.tran_id)}&key=${encodeURIComponent(buildInvoiceAccessToken(body.tran_id))}`,
    )
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('ssl/cancel')
  async sslCancel(@Body() body: SslCommerzIpnPayload, @Res() res: Response) {
    const siteUrl = resolveCustomerFacingSiteUrl()
    try {
      await this.ssl.handleCallback(body, 'cancel')
    } catch (err) {
      this.logger.error(
        `SSL cancel callback error: ${err instanceof Error ? err.message : 'unknown'}`,
      )
    }
    return res.redirect(
      `${siteUrl}/payment/cancelled?invoice=${encodeURIComponent(body.tran_id)}&key=${encodeURIComponent(buildInvoiceAccessToken(body.tran_id))}`,
    )
  }

  @Public()
  @Post('ssl/ipn')
  async sslIpn(@Body() body: SslCommerzIpnPayload) {
    const result = await this.ssl.handleCallback(body, 'ipn')
    if (result.ok) {
      await this.confirmation.confirm({
        invoiceNumber: result.invoiceNumber,
        method: 'SSLCOMMERZ',
        transactionId: body.bank_tran_id ?? body.val_id ?? body.tran_id,
        amount: Number.parseFloat(body.amount),
        gatewayResponse: body as never,
      })
    }
    return { received: true, status: result.status }
  }
}
