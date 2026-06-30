import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { Queue } from 'bullmq'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { GOOGLE_SYNC_JOB_TYPES } from './google.constants'

export interface GoogleSyncJobPayload {
  storeId: string
  jobType: string
  resourceId?: string
  triggeredBy?: string
}

@Injectable()
export class GoogleSyncQueueService {
  private readonly logger = new Logger(GoogleSyncQueueService.name)

  constructor(
    @InjectQueue('google-sync') private readonly queue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async isAutoSyncEnabled(storeId: string) {
    const conn = await this.prisma.googleWorkspaceConnection.findUnique({ where: { storeId } })
    return conn?.isConnected && conn.autoSyncEnabled
  }

  async enqueue(payload: GoogleSyncJobPayload) {
    const storeId = await resolveStoreId(this.prisma, payload.storeId)
    if (!(await this.isAutoSyncEnabled(storeId)) && payload.jobType !== GOOGLE_SYNC_JOB_TYPES.FULL_BACKUP) {
      return { queued: false, reason: 'auto_sync_disabled' }
    }

    const jobRecord = await this.prisma.googleSyncJob.create({
      data: {
        storeId,
        jobType: payload.jobType,
        status: 'queued',
        payload: payload as object,
        createdBy: payload.triggeredBy ?? null,
      },
    })

    const bullJob = await this.queue.add(
      payload.jobType,
      { ...payload, storeId, dbJobId: jobRecord.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    )

    await this.prisma.googleSyncJob.update({
      where: { id: jobRecord.id },
      data: { bullJobId: String(bullJob.id) },
    })

    return { queued: true, jobId: jobRecord.id, bullJobId: bullJob.id }
  }

  async onOrderPlaced(storeId: string, orderId: string) {
    return this.enqueue({
      storeId,
      jobType: GOOGLE_SYNC_JOB_TYPES.ORDER,
      resourceId: orderId,
      triggeredBy: 'order_event',
    })
  }

  async onCustomerCreated(storeId: string, customerId: string) {
    return this.enqueue({
      storeId,
      jobType: GOOGLE_SYNC_JOB_TYPES.CUSTOMER,
      resourceId: customerId,
      triggeredBy: 'customer_event',
    })
  }

  async onProductUpdated(storeId: string, productId: string) {
    return this.enqueue({
      storeId,
      jobType: GOOGLE_SYNC_JOB_TYPES.PRODUCT,
      resourceId: productId,
      triggeredBy: 'product_event',
    })
  }

  async manualFullSync(storeId: string, userId?: string) {
    return this.enqueue({
      storeId,
      jobType: GOOGLE_SYNC_JOB_TYPES.FULL_BACKUP,
      triggeredBy: userId ?? 'manual',
    })
  }
}
