import { Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { EmailService } from '../email/email.service'
import { generateInvoiceEmailBody } from '../invoices/invoice-email-body.template'
import { generateInvoiceEmailHTML } from '../invoices/invoice-email.template'
import { buildInvoiceViewModel } from '../invoices/invoice.helpers'
import { resolveCustomerFacingSiteUrl, SPLARO_INVOICE_BRAND, buildInvoiceAccessToken } from '@splaro/config'
import { TelegramService } from '../telegram/telegram.service'
import { CourierService } from '../courier/courier.service'

@Injectable()
export class OrderNotificationsService {
  private readonly logger = new Logger(OrderNotificationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegram: TelegramService,
    @Optional() private readonly courier: CourierService | null,
  ) {}

  async onOrderPlaced(storeId: string, orderId: string, customerEmail?: string): Promise<void> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: {
        items: {
          include: {
            variant: true,
            product: { select: { slug: true, sku: true, rmCode: true } },
          },
        },
        courier: true,
      },
    })
    if (!order) return

    const store = await this.prisma.store.findUnique({ where: { id: storeId } })
    const siteUrl = resolveCustomerFacingSiteUrl()

    await this.prisma.invoice.upsert({
      where: { orderId: order.id },
      create: { orderId: order.id, invoiceNumber: order.invoiceNumber },
      update: { invoiceNumber: order.invoiceNumber },
    })

    void this.telegram.notifyNewOrder(storeId, {
      invoiceNumber: order.invoiceNumber,
      total: Number(order.total),
      subtotal: Number(order.subtotal),
      deliveryCharge: Number(order.deliveryCharge),
      discount: Number(order.discount),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
      shippingName: order.shippingName,
      shippingPhone: order.shippingPhone,
      shippingEmail: order.shippingEmail,
      shippingAddress: order.shippingAddress,
      shippingCity: order.shippingCity,
      shippingDistrict: order.shippingDistrict,
      isInsideDhaka: order.isInsideDhaka,
      isCodRisk: order.isCodRisk,
      fraudFlags: order.fraudFlags,
      notes: order.notes,
      couponCode: order.couponCode,
      createdAt: order.createdAt,
      siteUrl,
      items: order.items.map((item) => ({
        productName: item.productName,
        slug: item.product?.slug,
        quantity: item.quantity,
        price: Number(item.price),
        subtotal: Number(item.subtotal),
        size: item.variant?.size,
        color: item.variant?.colorName || item.variant?.color,
        sku: item.sku || item.variant?.sku || item.product?.sku || item.product?.rmCode,
        variantName: item.variantName,
      })),
    })

    // Auto-book courier only for orders that are payable on delivery.
    // Prepaid orders (bKash/Nagad/SSL/card) are still PENDING payment at
    // placement — booking is triggered from payment confirmation instead,
    // so abandoned checkouts never create real consignments.
    const payableNow =
      order.paymentMethod === 'CASH_ON_DELIVERY' || order.paymentStatus === 'PAID'
    if (payableNow && process.env.AUTO_COURIER_BOOK !== 'false' && !order.courier?.consignmentId) {
      void this.courier
        ?.bookCourier(order.id)
        .catch((err) =>
          this.logger.error(
            `Auto courier booking failed for ${order.invoiceNumber}: ${err instanceof Error ? err.message : 'unknown'}`,
          ),
        )
    }

    const emailTo =
      customerEmail?.trim() ||
      order.shippingEmail?.trim() ||
      (await this.resolveCustomerEmail(order.shippingPhone, storeId))
    if (!emailTo || !emailTo.includes('@') || emailTo.endsWith('@splaro.local')) return

    const model = buildInvoiceViewModel({
      order,
      storeName: store?.name ?? SPLARO_INVOICE_BRAND.name,
      storeLogo: store?.logo ?? '',
      storeEmail: store?.email ?? SPLARO_INVOICE_BRAND.email,
      storePhone: store?.phone ?? SPLARO_INVOICE_BRAND.phone,
      siteUrl,
      customerEmail: emailTo,
      showToolbar: false,
    })
    const invoiceHtml = generateInvoiceEmailBody(model)
    const accessKey = buildInvoiceAccessToken(order.invoiceNumber)
    const site = siteUrl.replace(/\/$/, '')
    const trackUrl = `${site}/order-confirmation/${encodeURIComponent(order.invoiceNumber)}?key=${encodeURIComponent(accessKey)}`
    const invoiceUrl = `${site}/api/orders/${encodeURIComponent(order.invoiceNumber)}/invoice?key=${encodeURIComponent(accessKey)}`

    const emailed = await this.email.sendForStore({
      storeId,
      to: emailTo,
      subject: `Order confirmed — ${order.invoiceNumber} | SPLARO`,
      html: generateInvoiceEmailHTML({
        customerName: order.shippingName,
        invoiceNumber: order.invoiceNumber,
        total: Number(order.total),
        invoiceHtml,
        siteUrl,
        storeName: store?.name ?? 'SPLARO',
        accessKey,
      }),
      text: `Your SPLARO order ${order.invoiceNumber} is confirmed. Total: ৳${Number(order.total).toLocaleString()}.\nTrack: ${trackUrl}\nInvoice: ${invoiceUrl}`,
      transactional: true,
    })

    if (emailed) {
      await this.prisma.invoice.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          invoiceNumber: order.invoiceNumber,
          emailedAt: new Date(),
        },
        update: { emailedAt: new Date() },
      })
    } else {
      this.logger.warn(
        `Order confirmation email not sent for ${order.invoiceNumber} → ${emailTo} (SMTP/Gmail unavailable)`,
      )
    }
  }

  async onPaymentRedirect(
    storeId: string,
    input: { invoiceNumber: string; status: 'started' | 'returned' | 'failed'; gateway?: string },
  ): Promise<void> {
    await this.telegram.notifyPaymentEvent(storeId, input)
  }

  async onSmtpConfigured(storeId: string, smtp: { host: string; fromEmail: string; fromName: string }): Promise<void> {
    await this.telegram.notifySmtpConfigured(storeId, smtp)
  }

  private async resolveCustomerEmail(phone: string, storeId: string): Promise<string | null> {
    const customer = await this.prisma.customer.findFirst({
      where: { storeId, phone: { contains: phone.replace(/\D/g, '').slice(-10) } },
      select: { email: true },
    })
    if (customer?.email?.includes('@')) return customer.email

    const order = await this.prisma.order.findFirst({
      where: { storeId, shippingPhone: phone },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    if (!order) return null

    return null
  }
}
