import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { PrismaService } from '../../common/prisma.service'
import { GoogleSheetsFinanceService } from '../finance/finance-support.service'
import { TelegramIntegrationService } from '../integrations/telegram-integration.service'
import { NotificationsService } from '../notifications/notifications.service'
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
    private readonly notifications: NotificationsService,
    private readonly financeSheets: GoogleSheetsFinanceService,
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

      // A job carrying no resourceId is a whole-tab push — "Push this tab now"
      // in the admin, or Sync everything — not a request to sync one record.
      // Every branch below used to throw `<thing>Id required` in that case,
      // which meant the manual push button failed on every tab it was offered
      // on. Rebuilding the sheet is what the operator asked for, so do that.
      if (!resourceId) {
        result = await this.sheets.fullBackup(storeId, triggeredBy)
        if (dbJobId) {
          await this.prisma.googleSyncJob.update({
            where: { id: dbJobId },
            data: { status: 'completed', completedAt: new Date(), errorMsg: null },
          })
        }
        await this.financeSheets.markWorkspaceSyncComplete(storeId, triggeredBy).catch((err) => {
          this.logger.warn(
            `finance sync log refresh failed: ${err instanceof Error ? err.message : String(err)}`,
          )
        })
        return result
      }

      switch (jobType) {
        case GOOGLE_SYNC_JOB_TYPES.ORDER:
          result = await this.sheets.syncOrder(storeId, resourceId, triggeredBy)
          break
        case GOOGLE_SYNC_JOB_TYPES.CUSTOMER:
          result = await this.sheets.syncCustomer(storeId, resourceId, triggeredBy)
          break
        case GOOGLE_SYNC_JOB_TYPES.PRODUCT:
        case GOOGLE_SYNC_JOB_TYPES.INVENTORY:
          result = await this.sheets.syncProduct(storeId, resourceId, triggeredBy)
          break
        case GOOGLE_SYNC_JOB_TYPES.SUBSCRIBER:
          result = await this.sheets.syncSubscriber(storeId, resourceId, triggeredBy)
          break
        // Finance and the summary tabs are aggregates — there is no single
        // record to sync, so they only ever arrive here as a whole-tab push.
        // Neither had a case at all, so both failed as "Unknown job type".
        case GOOGLE_SYNC_JOB_TYPES.FINANCE:
        case GOOGLE_SYNC_JOB_TYPES.DAILY_SUMMARY:
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

      if (
        jobType === GOOGLE_SYNC_JOB_TYPES.FINANCE ||
        jobType === GOOGLE_SYNC_JOB_TYPES.DAILY_SUMMARY ||
        jobType === GOOGLE_SYNC_JOB_TYPES.FULL_BACKUP
      ) {
        await this.financeSheets.markWorkspaceSyncComplete(storeId, triggeredBy).catch((err) => {
          this.logger.warn(
            `finance sync log refresh failed: ${err instanceof Error ? err.message : String(err)}`,
          )
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
        // Telegram can be off or unconfigured — the tray must still show it.
        await this.notifications.notifySyncFailed(storeId, jobType, msg).catch(() => undefined)
      }

      throw err
    }
  }
}
