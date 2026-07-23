import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { existsSync } from 'node:fs'
import { PrismaService } from '../../common/prisma.service'
import { EmailService } from '../email/email.service'
import { buildInvoiceViewModel, type InvoiceOrder } from './invoice.helpers'
import { generateInvoiceEmailBody } from './invoice-email-body.template'
import { generateInvoiceHTML } from './invoice.template'
import { generateInvoiceEmailHTML } from './invoice-email.template'
import { SPLARO_INVOICE_BRAND, resolveCustomerFacingSiteUrl, buildInvoiceAccessToken } from '@splaro/config'

function resolveChromeExecutable(puppeteerExecutablePath: () => string): string | undefined {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim()
  if (fromEnv && existsSync(fromEnv)) return fromEnv

  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    // Windows — Puppeteer PDF on local/dev PCs
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ]
  for (const path of candidates) {
    if (existsSync(path)) return path
  }

  try {
    const bundled = puppeteerExecutablePath()
    if (bundled && existsSync(bundled)) return bundled
  } catch {
    /* bundled chrome not installed */
  }
  return undefined
}

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
    const siteUrl = resolveCustomerFacingSiteUrl(SPLARO_INVOICE_BRAND.website)
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
      const executablePath = resolveChromeExecutable(() => puppeteer.default.executablePath())
      if (!executablePath) {
        throw new Error(
          'Chrome not found for PDF. Set PUPPETEER_EXECUTABLE_PATH or install Chrome.',
        )
      }

      const browser = await puppeteer.default.launch({
        headless: true,
        executablePath,
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
      const message = error instanceof Error ? error.message : 'unknown'
      this.logger.warn(`PDF generation unavailable (${message}). Use Print → Save as PDF.`)
      throw new ServiceUnavailableException(
        'PDF engine unavailable. Use Print → Save as PDF, or set PUPPETEER_EXECUTABLE_PATH to Chrome.',
      )
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
    const invoiceHtml = generateInvoiceEmailBody(model)
    const accessKey = buildInvoiceAccessToken(order.invoiceNumber)
    const site = store.siteUrl.replace(/\/$/, '')
    const trackUrl = `${site}/order-confirmation/${encodeURIComponent(order.invoiceNumber)}?key=${encodeURIComponent(accessKey)}`
    const invoiceUrl = `${site}/api/orders/${encodeURIComponent(order.invoiceNumber)}/invoice?key=${encodeURIComponent(accessKey)}`
    const sent = await this.email.sendForStore({
      storeId: order.storeId,
      to: emailTo,
      subject: `Order confirmed – ${order.invoiceNumber}`,
      html: generateInvoiceEmailHTML({
        customerName: order.shippingName,
        invoiceNumber: order.invoiceNumber,
        total: Number(order.total),
        invoiceHtml,
        siteUrl: store.siteUrl,
        storeName: store.storeName,
        accessKey,
      }),
      text: `SPLARO order ${order.invoiceNumber} confirmed. Total ${Number(order.total).toLocaleString()} BDT.\nTrack: ${trackUrl}\nInvoice: ${invoiceUrl}`,
      transactional: true,
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
    const accessKey = buildInvoiceAccessToken(order.invoiceNumber)
    const base = siteUrl.replace(/\/$/, '')
    const invoiceUrl = `${base}/api/orders/${encodeURIComponent(order.invoiceNumber)}/invoice?key=${encodeURIComponent(accessKey)}`
    const trackUrl = `${base}/order-confirmation/${encodeURIComponent(order.invoiceNumber)}?key=${encodeURIComponent(accessKey)}`
    const message = [
      `SPLARO Invoice ${order.invoiceNumber}`,
      `Customer: ${order.shippingName}`,
      `Total: ৳${Number(order.total).toLocaleString()}`,
      `Payment: ${order.paymentMethod.replace(/_/g, ' ')}`,
      `Track: ${trackUrl}`,
      `Invoice: ${invoiceUrl}`,
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
