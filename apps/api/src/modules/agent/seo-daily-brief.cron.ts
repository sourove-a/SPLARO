import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../common/prisma.service'
import { isSchedulerInstance } from '../../common/scheduler-instance.util'
import { NotificationsService } from '../notifications/notifications.service'
import { buildSeoDailyBrief } from './seo-daily-brief.util'

@Injectable()
export class SeoDailyBriefCron {
  private readonly logger = new Logger(SeoDailyBriefCron.name)
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Read-only daily brief. Never changes product metadata or requests an LLM. */
  @Cron('15 6 * * *', { timeZone: 'Asia/Dhaka' })
  async publishDailyBrief() {
    if (!isSchedulerInstance()) return
    if (this.running) return
    this.running = true
    try {
      const stores = await this.prisma.store.findMany({ select: { id: true } })
      const searchSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      for (const store of stores) {
        const [products, searches] = await Promise.all([
          this.prisma.product.findMany({
            where: { storeId: store.id, isPublished: true },
            select: { id: true, name: true, slug: true, metaTitle: true, metaDescription: true },
            take: 500,
          }),
          this.prisma.searchAnalytics.findMany({
            where: { storeId: store.id, createdAt: { gte: searchSince } },
            select: { query: true },
            take: 1000,
          }),
        ])
        const brief = buildSeoDailyBrief(products, searches)
        await this.notifications.notifyInApp({
          storeId: store.id,
          subject: brief.subject,
          body: brief.body,
          href: '/dashboard/seo-health',
          level: brief.level,
          dedupeWindowMinutes: 20 * 60,
        })
      }
    } catch (error) {
      this.logger.warn(`Daily SEO brief failed: ${error instanceof Error ? error.message : error}`)
    } finally {
      this.running = false
    }
  }
}
