import { Injectable, Logger, Optional } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { EmailService } from '../email/email.service'
import { generateInvoiceHTML } from '../invoices/invoice.template'
import { buildInvoiceViewModel } from '../invoices/invoice.helpers'
import { generateInvoiceEmailHTML } from '../invoices/invoice-email.template'
import { SPLARO_INVOICE_BRAND } from '@splaro/config'
import { TelegramService } from '../telegram/telegram.service'
import { CourierService } from '../courier/courier.service'

@Injectable()
export class OrderNotificationsService {
  private readonly logger = new Logger(OrderNotificationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly telegram: TelegramService,
    @Optional() private readonly courier: CourierService | null,
  ) {}

  async onOrderPlaced(storeId: string, orderId: string, customerEmail?: string): Promise<void> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: { items: { include: { variant: true } }, courier: true },
    })
    if (!order) return

    const store = await this.prisma.store.findUnique({ where: { id: storeId } })

    await this.prisma.invoice.upsert({
      where: { orderId: order.id },
      create: { orderId: order.id, invoiceNumber: order.invoiceNumber },
      update: { invoiceNumber: order.invoiceNumber },
    })

    void this.telegram.notifyNewOrder(storeId, {
      invoiceNumber: order.invoiceNumber,
      total: Number(order.total),
      paymentMethod: order.paymentMethod,
      shippingName: order.shippingName,
      shippingPhone: order.shippingPhone,
      shippingCity: order.shippingCity,
      itemCount: order.items.length,
      isCodRisk: order.isCodRisk,
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

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? SPLARO_INVOICE_BRAND.website
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
    const invoiceHtml = generateInvoiceHTML(model, { showToolbar: false, mode: 'fragment' })

    const emailed = await this.email.sendForStore({
      storeId,
      to: emailTo,
      subject: `Your SPLARO order ${order.invoiceNumber}`,
      html: generateInvoiceEmailHTML({
        customerName: order.shippingName,
        invoiceNumber: order.invoiceNumber,
        total: Number(order.total),
        invoiceHtml,
        siteUrl,
        storeName: store?.name ?? 'SPLARO',
      }),
      text: `Thank you for your order ${order.invoiceNumber}. Total: ৳${Number(order.total).toLocaleString()}`,
      transactional: true,
    })

    if (emailed) {
      await this.prisma.invoice.update({
        where: { orderId: order.id },
        data: { emailedAt: new Date() },
      })
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
