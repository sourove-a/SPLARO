import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import { PrintService } from './print.service'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'

@Controller('admin/print')
export class PrintController {
  constructor(
    private readonly print: PrintService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /* ─── Invoice ─────────────────────────────────────────────── */

  @Get('invoice/:orderId')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async invoice(
    @Param('orderId') orderId: string,
    @Query('autoPrint') autoPrint?: string,
  ) {
    return this.print.invoiceHtml(orderId, {
      showToolbar: true,
      autoPrint: autoPrint === '1' || autoPrint === 'true',
    })
  }

  /* ─── Packing slip ────────────────────────────────────────── */

  @Get('packing-slip/:orderId')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async packingSlip(
    @Param('orderId') orderId: string,
    @Query('autoPrint') autoPrint?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { select: { productName: true, variantName: true, quantity: true, sku: true } },
      },
    })
    if (!order) return '<html><body>Order not found</body></html>'

    const rows = order.items
      .map(
        (i) => `<tr>
        <td>${i.productName}${i.variantName ? ` — ${i.variantName}` : ''}</td>
        <td>${i.sku ?? ''}</td>
        <td>${i.quantity}</td>
      </tr>`,
      )
      .join('')

    return `<!DOCTYPE html><html><head><title>Packing Slip ${order.invoiceNumber ?? orderId}</title>
    <style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px}</style>
    ${autoPrint === '1' ? '<script>window.onload=()=>window.print()</script>' : ''}
    </head><body>
    <h2>Packing Slip</h2>
    <p><strong>Order:</strong> ${order.invoiceNumber ?? orderId}</p>
    <p><strong>Ship to:</strong> ${order.shippingName ?? ''}, ${order.shippingAddress ?? ''}, ${order.shippingDistrict ?? ''}</p>
    <table><thead><tr><th>Item</th><th>SKU</th><th>Qty</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`
  }

  /* ─── Shipping label ──────────────────────────────────────── */

  @Get('label/:orderId')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async shippingLabel(
    @Param('orderId') orderId: string,
    @Query('autoPrint') autoPrint?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { store: { select: { name: true, address: true, phone: true } } },
    })
    if (!order) return '<html><body>Order not found</body></html>'

    const courier = await this.prisma.courierShipment.findFirst({
      where: { orderId },
      select: { trackingCode: true, trackingUrl: true, provider: true },
    })

    return `<!DOCTYPE html><html><head><title>Label ${order.invoiceNumber ?? orderId}</title>
    <style>
      body{font-family:Arial;margin:0;padding:20px}
      .label{border:2px solid #000;padding:16px;max-width:400px;page-break-inside:avoid}
      .from{font-size:12px;margin-bottom:12px;color:#555}
      .to{font-size:18px;font-weight:bold;margin-bottom:8px}
      .tracking{font-size:13px;background:#f5f5f5;padding:8px;border-radius:4px;margin-top:12px}
      .invoice{font-size:24px;font-weight:900;text-align:center;margin-top:16px}
    </style>
    ${autoPrint === '1' ? '<script>window.onload=()=>window.print()</script>' : ''}
    </head><body>
    <div class="label">
      <div class="from">FROM: ${order.store?.name ?? 'SPLARO'} | ${order.store?.address ?? ''} | ${order.store?.phone ?? ''}</div>
      <div class="to">TO: ${order.shippingName ?? ''}</div>
      <div>${order.shippingAddress ?? ''}</div>
      <div>${order.shippingDistrict ?? ''}${order.shippingPostal ? ', ' + order.shippingPostal : ''}</div>
      <div>Phone: ${order.shippingPhone ?? ''}</div>
      ${courier ? `<div class="tracking">${courier.provider}: ${courier.trackingCode ?? ''}</div>` : ''}
      <div class="invoice">#${order.invoiceNumber ?? orderId}</div>
    </div>
    </body></html>`
  }

  /* ─── Bulk print ──────────────────────────────────────────── */

  @Post('bulk-invoices')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async bulkInvoices(@Body('orderIds') orderIds: string[]) {
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return '<html><body>No orders specified</body></html>'
    }
    const pages = await Promise.all(
      orderIds.slice(0, 50).map((id) =>
        this.print.invoiceHtml(id, { showToolbar: false, autoPrint: false }),
      ),
    )
    return `<!DOCTYPE html><html><head>
    <style>@media print{.page-break{page-break-after:always}}</style>
    <script>window.onload=()=>window.print()</script>
    </head><body>${pages.map((p, i) => `<div class="page-break">${p}</div>`).join('')}</body></html>`
  }

  /* ─── Print job queue ─────────────────────────────────────── */

  @Get('jobs')
  async listJobs(
    @Query('storeId') storeId: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const take = Math.min(Number(limit) || 30, 100)
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take

    const where = {
      order: { storeId: sid },
      ...(status ? { status: status as 'QUEUED' | 'PRINTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' } : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.printJob.findMany({
        where,
        orderBy: { queuedAt: 'desc' },
        skip,
        take,
        include: {
          order: { select: { invoiceNumber: true, shippingName: true } },
        },
      }),
      this.prisma.printJob.count({ where }),
    ])

    return { items, total, page: Number(page) || 1, limit: take }
  }

  @Post('jobs')
  async createJob(
    @Body()
    body: {
      orderId: string
      type: string
      printerName?: string
      copies?: number
    },
  ) {
    return this.prisma.printJob.create({
      data: {
        orderId: body.orderId,
        type: body.type as 'INVOICE_A4' | 'RECEIPT_THERMAL' | 'SHIPPING_LABEL' | 'REPORT',
        printerName: body.printerName,
        copies: body.copies ?? 1,
        status: 'QUEUED',
      },
    })
  }

  @Patch('jobs/:id/status')
  async updateJobStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('errorMsg') errorMsg?: string,
  ) {
    const data: Record<string, unknown> = { status }
    if (status === 'PRINTING') data.startedAt = new Date()
    if (status === 'COMPLETED') data.completedAt = new Date()
    if (errorMsg) data.errorMsg = errorMsg

    return this.prisma.printJob.update({ where: { id }, data })
  }

  @Post('jobs/:id/retry')
  async retryJob(@Param('id') id: string) {
    return this.prisma.printJob.update({
      where: { id },
      data: { status: 'QUEUED', errorMsg: null, retryCount: { increment: 1 } },
    })
  }

  /** Stats: jobs by status */
  @Get('jobs/stats')
  async jobStats(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.prisma.printJob.groupBy({
      by: ['status', 'type'],
      where: { order: { storeId: sid } },
      _count: true,
      orderBy: { _count: { status: 'desc' } },
    })
  }
}
