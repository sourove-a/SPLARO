import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { PrismaService } from '../../common/prisma.service'
import { TelegramIntegrationService } from '../integrations/telegram-integration.service'
import { GOOGLE_SYNC_JOB_TYPES } from './google.constants'
import { GoogleSheetsSyncService } from './google-sheets-sync.service'
import type { GoogleSyncJobPayload } from './google-sync-queue.service'

@Processor('google-sync')
export class GoogleSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(GoogleSyncProcessor.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly sheets: GoogleSheetsSyncService,
    private readonly telegram: TelegramIntegrationService,
  ) {
    super()
  }

  async process(job: Job<GoogleSyncJobPayload & { dbJobId?: string }>) {
    const { storeId, jobType, resourceId, triggeredBy, dbJobId } = job.data
    if (dbJobId) {
      await this.prisma.googleSyncJob.update({
        where: { id: dbJobId },
        data: { status: 'active', startedAt: new Date(), attempts: job.attemptsMade + 1 },
      })
    }

    try {
      let result: unknown
      switch (jobType) {
        case GOOGLE_SYNC_JOB_TYPES.ORDER:
          if (!resourceId) throw new Error('orderId required')
          result = await this.sheets.syncOrder(storeId, resourceId, triggeredBy)
          break
        case GOOGLE_SYNC_JOB_TYPES.CUSTOMER:
          if (!resourceId) throw new Error('customerId required')
          result = await this.sheets.syncCustomer(storeId, resourceId, triggeredBy)
          break
        case GOOGLE_SYNC_JOB_TYPES.PRODUCT:
        case GOOGLE_SYNC_JOB_TYPES.INVENTORY:
          if (!resourceId) throw new Error('productId required')
          result = await this.sheets.syncProduct(storeId, resourceId, triggeredBy)
          break
        case GOOGLE_SYNC_JOB_TYPES.SUBSCRIBER:
          if (!resourceId) throw new Error('subscriberId required')
          result = await this.sheets.syncSubscriber(storeId, resourceId, triggeredBy)
          break
        case GOOGLE_SYNC_JOB_TYPES.FULL_BACKUP:
          result = await this.sheets.fullBackup(storeId, triggeredBy)
          break
        default:
          throw new Error(`Unknown job type: ${jobType}`)
      }

      if (dbJobId) {
        await this.prisma.googleSyncJob.update({
          where: { id: dbJobId },
          data: { status: 'completed', completedAt: new Date(), errorMsg: null },
        })
      }
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed'
      this.logger.error(`${jobType} failed: ${msg}`)

      if (dbJobId) {
        await this.prisma.googleSyncJob.update({
          where: { id: dbJobId },
          data: { status: job.attemptsMade + 1 >= (job.opts.attempts ?? 3) ? 'failed' : 'queued', errorMsg: msg },
        })
      }

      await this.prisma.googleSyncLog.create({
        data: {
          storeId,
          jobType,
          resourceId: resourceId ?? null,
          status: 'failed',
          errorMsg: msg,
          retryCount: job.attemptsMade,
          triggeredBy: triggeredBy ?? null,
        },
      })

      await this.prisma.googleWorkspaceConnection.update({
        where: { storeId },
        data: { lastError: msg },
      })

      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 3)) {
        await this.telegram
          .test(storeId, undefined, `⚠️ SPLARO Google Sync failed: ${jobType}\n${msg}`)
          .catch(() => undefined)
      }

      throw err
    }
  }
}
