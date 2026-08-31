import { Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { EmailService } from '../email/email.service'
import { generateInvoiceEmailBody } from '../invoices/invoice-email-body.template'
import { generateInvoiceEmailHTML } from '../invoices/invoice-email.template'
import { buildInvoiceViewModel } from '../invoices/invoice.helpers'
import {
  resolveCustomerFacingSiteUrl,
  SPLARO_INVOICE_BRAND,
} from '@splaro/config'
import {
  buildInvoiceAccessToken,
} from '@splaro/config/invoice-access'
import {
  generateOrderEditedEmail,
  generateOrderUpdateEmail,
  ORDER_STATUS_EMAILS,
  RMA_STATUS_EMAILS,
} from '../email/order-update-email.template'
import { TelegramService } from '../telegram/telegram.service'
import { CourierService } from '../courier/courier.service'
import { NotificationsService } from './notifications.service'
import { formatBDT } from '../../common/utils/currency'

@Injectable()
export class OrderNotificationsService {
  private readonly logger = new Logger(OrderNotificationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegram: TelegramService,
    private readonly notifications: NotificationsService,
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

    await this.notifications.notifyInApp({
      storeId,
      subject: `New order · ${order.invoiceNumber}`,
      body: `${order.shippingName} · ${formatBDT(Number(order.total))} · ${order.paymentMethod.replace(/_/g, ' ')}`,
      href: `/dashboard/orders/${encodeURIComponent(order.invoiceNumber)}`,
      level: 'critical',
      // Invoice numbers are reused after delete (SPL-1001 came back). A forever
      // dedupe hid the new placement from Notification Center.
      dedupeWindowMinutes: 30,
    })

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

    const alreadyEmailed = await this.prisma.invoice.findUnique({
      where: { orderId: order.id },
      select: { emailedAt: true },
    })
    if (alreadyEmailed?.emailedAt) return

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

  /**
   * Tell the customer their order moved.
   *
   * Every status change already reached the shop's own Telegram; the person
   * waiting for the parcel was the one party never told. Statuses not in the
   * copy table are internal bookkeeping and send nothing.
   */
  async onOrderStatusChangedEmail(
    storeId: string,
    orderId: string,
    status: string,
    note?: string,
  ): Promise<boolean> {
    const copy = ORDER_STATUS_EMAILS[status.toUpperCase()]
    if (!copy) return false

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: { courier: true },
    })
    if (!order) return false

    // Placement already sends the full invoice with the same words, so a
    // CONFIRMED mail moments later would be the second copy of one event.
    if (status.toUpperCase() === 'CONFIRMED') {
      const invoice = await this.prisma.invoice.findUnique({
        where: { orderId: order.id },
        select: { emailedAt: true },
      })
      if (invoice?.emailedAt) return false
    }

    const emailTo = await this.resolveOrderEmail(order.shippingEmail, order.shippingPhone, storeId)
    if (!emailTo) return false

    const store = await this.prisma.store.findUnique({ where: { id: storeId } })
    const siteUrl = resolveCustomerFacingSiteUrl()
    const site = siteUrl.replace(/\/$/, '')
    const accessKey = buildInvoiceAccessToken(order.invoiceNumber)
    const built = generateOrderUpdateEmail({
      copy,
      customerName: order.shippingName,
      reference: order.invoiceNumber,
      total: Number(order.total),
      trackUrl: `${site}/order-confirmation/${encodeURIComponent(order.invoiceNumber)}?key=${encodeURIComponent(accessKey)}`,
      // The shipment row names its provider as an enum (STEADFAST); the
      // customer should read a courier name, not a database constant.
      courierName: order.courier?.provider
        ? order.courier.provider.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())
        : null,
      trackingNumber: order.courier?.trackingCode ?? order.courier?.consignmentId ?? null,
      note: note ?? null,
      storeName: store?.name ?? 'SPLARO',
      siteUrl,
    })

    const sent = await this.email.sendForStore({
      storeId,
      to: emailTo,
      subject: built.subject,
      html: built.html,
      text: built.text,
      transactional: true,
    })
    if (!sent) {
      this.logger.warn(
        `Status email (${status}) not sent for ${order.invoiceNumber} → ${emailTo} (SMTP/Gmail unavailable)`,
      )
    }
    return sent
  }

  /**
   * Tell the customer their order was corrected by staff.
   *
   * Sent transactional so the marketing toggle cannot suppress it — someone who
   * agreed to one order is being shown a different one and has to see it.
   * Returns whether the mail actually left, so the admin can say so honestly.
   */
  async onOrderEdited(
    storeId: string,
    orderId: string,
    change: { changes: string[]; note?: string },
  ): Promise<boolean> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: { items: true },
    })
    if (!order) return false

    const emailTo = await this.resolveOrderEmail(order.shippingEmail, order.shippingPhone, storeId)
    if (!emailTo) return false

    const store = await this.prisma.store.findUnique({ where: { id: storeId } })
    const siteUrl = resolveCustomerFacingSiteUrl()
    const site = siteUrl.replace(/\/$/, '')
    const accessKey = buildInvoiceAccessToken(order.invoiceNumber)

    const built = generateOrderEditedEmail({
      customerName: order.shippingName,
      invoiceNumber: order.invoiceNumber,
      items: order.items.map((item) => ({
        name: item.productName,
        detail: item.variantName ?? item.sku,
        quantity: item.quantity,
        unitCost: Number(item.price),
        lineTotal: Number(item.subtotal),
      })),
      total: Number(order.total),
      changes: change.changes,
      note: change.note ?? null,
      trackUrl: `${site}/order-confirmation/${encodeURIComponent(order.invoiceNumber)}?key=${encodeURIComponent(accessKey)}`,
      storeName: store?.name ?? 'SPLARO',
      siteUrl,
    })

    const sent = await this.email.sendForStore({
      storeId,
      to: emailTo,
      subject: built.subject,
      html: built.html,
      text: built.text,
      transactional: true,
    })
    if (!sent) {
      this.logger.warn(
        `Order edited email not sent for ${order.invoiceNumber} → ${emailTo} (SMTP/Gmail unavailable)`,
      )
    }
    return sent
  }

  /** Tell the customer where their return stands. */
  async onRmaStatusChangedEmail(storeId: string, rmaId: string, status: string): Promise<boolean> {
    const copy = RMA_STATUS_EMAILS[status.toUpperCase()]
    if (!copy) return false

    const rma = await this.prisma.rMA.findFirst({
      where: { id: rmaId, storeId },
      include: {
        order: { select: { shippingEmail: true, shippingPhone: true, shippingName: true } },
        customer: { select: { email: true, firstName: true } },
      },
    })
    if (!rma) return false

    const emailTo = await this.resolveOrderEmail(
      rma.customer?.email ?? rma.order?.shippingEmail ?? null,
      rma.order?.shippingPhone ?? '',
      storeId,
    )
    if (!emailTo) return false

    const store = await this.prisma.store.findUnique({ where: { id: storeId } })
    const built = generateOrderUpdateEmail({
      copy,
      customerName: rma.customer?.firstName || rma.order?.shippingName || 'there',
      reference: rma.rmaNumber,
      note: rma.adminNotes,
      storeName: store?.name ?? 'SPLARO',
      siteUrl: resolveCustomerFacingSiteUrl(),
    })

    return this.email.sendForStore({
      storeId,
      to: emailTo,
      subject: built.subject,
      html: built.html,
      text: built.text,
      transactional: true,
    })
  }

  /**
   * The address to write to, or null.
   *
   * `@splaro.local` is what checkout stores for a phone-only customer — it is a
   * placeholder, not a mailbox, and sending to it bounces every time.
   */
  private async resolveOrderEmail(
    given: string | null | undefined,
    phone: string,
    storeId: string,
  ): Promise<string | null> {
    const direct = given?.trim()
    if (direct && direct.includes('@') && !direct.endsWith('@splaro.local')) return direct
    const fallback = phone ? await this.resolveCustomerEmail(phone, storeId) : null
    if (fallback && fallback.includes('@') && !fallback.endsWith('@splaro.local')) return fallback
    return null
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
