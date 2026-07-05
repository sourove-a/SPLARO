import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { NotificationsService } from './notifications.service'
import { EmailService } from '../email/email.service'

@Controller('admin/notifications')
export class NotificationsController {
  constructor(
    @Inject(NotificationsService) private readonly notify: NotificationsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmailService) private readonly email: EmailService,
  ) {}

  /** Admin notification log (Telegram messages sent to store) */
  @Get('log')
  async log(
    @Query('storeId') storeId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const take = Math.min(Number(limit) || 30, 100)
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          storeId: sid,
          action: { in: ['NOTIFICATION_SENT', 'TELEGRAM_SENT', 'EMAIL_SENT'] },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({
        where: {
          storeId: sid,
          action: { in: ['NOTIFICATION_SENT', 'TELEGRAM_SENT', 'EMAIL_SENT'] },
        },
      }),
    ])

    return { items, total, page: Number(page) || 1, limit: take }
  }

  /** Send a test admin notification (Telegram) */
  @Post('test/telegram')
  async testTelegram(@Body() body: { storeId: string; message?: string }) {
    await this.notify.notifyAdmin({
      storeId: body.storeId,
      subject: 'Test notification',
      body: body.message ?? 'SPLARO admin notification test ✓',
      level: 'info',
    })
    return { ok: true }
  }

  /** Send a test email */
  @Post('test/email')
  async testEmail(@Body() body: { storeId: string; to?: string }) {
    const to = body.to?.trim()
    if (!to) throw new BadRequestException('Recipient email address (to) is required')
    const sid = await resolveStoreId(this.prisma, body.storeId)
    const sent = await this.email.sendForStore({
      storeId: sid,
      to,
      subject: 'SPLARO test email ✓',
      html: '<h2>Test email from SPLARO</h2><p>Your SMTP configuration is working correctly.</p>',
      transactional: true,
    })
    return { ok: sent }
  }

  /** Verify SMTP configuration */
  @Post('verify/smtp')
  async verifySmtp(@Body('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.email.verifySmtp(sid)
  }

  /** Notification preferences for the store */
  @Get('preferences/:storeId')
  async preferences(@Param('storeId') storeId: string) {
    const settings = await this.prisma.siteSettings.findFirst({
      where: { store: { OR: [{ id: storeId }, { slug: storeId }] } },
      select: {
        emailEnabled: true,
        telegramEnabled: true,
        storefrontConfig: true,
      },
    })
    if (!settings) return { emailEnabled: false, telegramConfigured: false }
    const cfg = settings.storefrontConfig as Record<string, unknown> | null
    const smtp = cfg?.smtp as Record<string, unknown> | null
    const tg = cfg?.telegram as Record<string, unknown> | null
    return {
      emailEnabled: settings.emailEnabled,
      smtpConfigured: !!(smtp?.host),
      telegramEnabled: settings.telegramEnabled,
      telegramConfigured: !!(tg?.botToken && tg?.chatId),
    }
  }

  /** Low-stock alert summary — useful to trigger from cron */
  @Get('low-stock')
  async lowStockAlerts(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const variants = await this.prisma.productVariant.findMany({
      where: {
        product: { storeId: sid, status: { not: 'ARCHIVED' } },
        stock: { lte: 5, gt: 0 },
      },
      include: {
        product: { select: { name: true } },
      },
      orderBy: { stock: 'asc' },
    })
    return variants.map((v) => ({
      variantId: v.id,
      sku: v.sku,
      productName: (v as typeof v & { product?: { name: string } }).product?.name ?? '',
      stock: v.stock,
    }))
  }

  /** Trigger low-stock notifications for all low-stock items */
  @Post('trigger/low-stock')
  async triggerLowStockAlerts(@Body('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const variants = await this.prisma.productVariant.findMany({
      where: {
        product: { storeId: sid, status: { not: 'ARCHIVED' } },
        stock: { lte: 5, gt: 0 },
      },
      include: { product: { select: { name: true } } },
    })

    for (const v of variants) {
      const name = (v as typeof v & { product?: { name: string } }).product?.name ?? 'Unknown'
      await this.notify.notifyLowStock(sid, name, v.sku ?? v.id, v.stock)
    }

    return { triggered: variants.length }
  }
}
