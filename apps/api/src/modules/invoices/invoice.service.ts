import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { EmailService } from '../email/email.service'
import { buildInvoiceViewModel, type InvoiceOrder } from './invoice.helpers'
import { generateInvoiceHTML } from './invoice.template'
import { generateInvoiceEmailHTML } from './invoice-email.template'
import { SPLARO_INVOICE_BRAND } from '@splaro/config'

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async loadOrder(orderRef: string): Promise<InvoiceOrder> {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id: orderRef }, { invoiceNumber: orderRef }] },
      include: {
        items: { include: { variant: true } },
        courier: true,
        customer: { select: { email: true } },
      },
    })
    if (!order) throw new NotFoundException('Order not found')
    return order
  }

  private async storeContext(storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } })
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? SPLARO_INVOICE_BRAND.website
    return {
      storeName: store?.name ?? SPLARO_INVOICE_BRAND.name,
      storeLogo: store?.logo ?? '',
      storeEmail: store?.email ?? SPLARO_INVOICE_BRAND.email,
      storePhone: store?.phone ?? SPLARO_INVOICE_BRAND.phone,
      siteUrl,
    }
  }

  async buildHtml(
    orderId: string,
    options?: { showToolbar?: boolean; autoPrint?: boolean },
  ): Promise<string> {
    const order = await this.loadOrder(orderId)
    const store = await this.storeContext(order.storeId)
    const model = buildInvoiceViewModel({
      order,
      ...store,
      customerEmail: order.customer?.email ?? null,
      showToolbar: options?.showToolbar,
      autoPrint: options?.autoPrint,
    })
    return generateInvoiceHTML(model, options)
  }

  async buildPdfBuffer(orderId: string): Promise<Buffer> {
    const html = await this.buildHtml(orderId, { showToolbar: false, autoPrint: false })
    try {
      const puppeteer = await import('puppeteer')
      const browser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
      })
      try {
        const page = await browser.newPage()
        await page.setContent(html, { waitUntil: 'load', timeout: 45_000 })
        const pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
        })
        return Buffer.from(pdf)
      } finally {
        await browser.close()
      }
    } catch (error) {
      this.logger.warn(
        `PDF generation unavailable (${error instanceof Error ? error.message : 'unknown'}). Install puppeteer or use Print/Save as PDF.`,
      )
      throw error
    }
  }

  async sendInvoiceEmail(orderId: string, toEmail?: string): Promise<{ sent: boolean; to?: string }> {
    const order = await this.loadOrder(orderId)
    const store = await this.storeContext(order.storeId)
    const emailTo =
      toEmail?.trim() ||
      order.customer?.email?.trim() ||
      ''

    if (!emailTo || !emailTo.includes('@') || emailTo.endsWith('@splaro.local')) {
      return { sent: false }
    }

    const model = buildInvoiceViewModel({
      order,
      ...store,
      customerEmail: emailTo,
      showToolbar: false,
    })
    const invoiceHtml = generateInvoiceHTML(model, { showToolbar: false, mode: 'fragment' })
    const sent = await this.email.sendForStore({
      storeId: order.storeId,
      to: emailTo,
      subject: `SPLARO Invoice ${order.invoiceNumber}`,
      html: generateInvoiceEmailHTML({
        customerName: order.shippingName,
        invoiceNumber: order.invoiceNumber,
        total: Number(order.total),
        invoiceHtml,
        siteUrl: store.siteUrl,
        storeName: store.storeName,
      }),
      text: `Your SPLARO invoice ${order.invoiceNumber} total ${Number(order.total).toLocaleString()} BDT.`,
    })

    if (sent) {
      await this.prisma.invoice.upsert({
        where: { orderId: order.id },
        create: { orderId: order.id, invoiceNumber: order.invoiceNumber, emailedAt: new Date() },
        update: { emailedAt: new Date() },
      })
    }

    return { sent, to: emailTo }
  }

  buildWhatsAppShareUrl(order: InvoiceOrder, siteUrl: string): string {
    const invoiceUrl = `${siteUrl.replace(/\/$/, '')}/track-order?invoice=${encodeURIComponent(order.invoiceNumber)}`
    const message = [
      `SPLARO Invoice ${order.invoiceNumber}`,
      `Customer: ${order.shippingName}`,
      `Total: ৳${Number(order.total).toLocaleString()}`,
      `Payment: ${order.paymentMethod.replace(/_/g, ' ')}`,
      `Track: ${invoiceUrl}`,
    ].join('\n')

    return `https://wa.me/${SPLARO_INVOICE_BRAND.phoneE164}?text=${encodeURIComponent(message)}`
  }

  buildCustomerWhatsAppUrl(order: InvoiceOrder): string | null {
    const digits = order.shippingPhone.replace(/\D/g, '')
    if (digits.length < 10) return null
    const normalized = digits.startsWith('880') ? digits : `880${digits.replace(/^0/, '')}`
    const message = `Hello ${order.shippingName}, your SPLARO invoice ${order.invoiceNumber} is ready. Total: ৳${Number(order.total).toLocaleString()}. Thank you for shopping with SPLARO.`
    return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
  }
}
