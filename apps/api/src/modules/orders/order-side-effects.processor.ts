import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import type { Job } from 'bullmq'
import {
  OrderSideEffectsQueueService,
  type OrderPlacedSideEffectPayload,
} from './order-side-effects-queue.service'

@Processor('order-side-effects')
export class OrderSideEffectsProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderSideEffectsProcessor.name)

  constructor(private readonly sideEffects: OrderSideEffectsQueueService) {
    super()
  }

  async process(job: Job<OrderPlacedSideEffectPayload>) {
    if (job.name !== 'order-placed') {
      this.logger.warn(`Unknown order-side-effects job: ${job.name}`)
      return
    }
    return this.sideEffects.processOrderPlaced(job.data)
  }
}
