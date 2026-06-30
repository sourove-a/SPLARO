import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import type { CourierProvider } from '@prisma/client'
import { CourierService } from './courier.service'

interface RetryBookingPayload {
  orderId: string
  provider?: CourierProvider
  attempt: number
}

@Processor('courier')
export class CourierProcessor extends WorkerHost {
  private readonly logger = new Logger(CourierProcessor.name)

  constructor(private readonly courier: CourierService) {
    super()
  }

  async process(job: Job<RetryBookingPayload>) {
    if (job.name !== 'retry-booking') {
      this.logger.warn(`Unknown courier job: ${job.name}`)
      return
    }

    const { orderId, provider, attempt } = job.data
    this.logger.log(`Retrying courier booking for order ${orderId} (attempt ${attempt})`)
    return this.courier.bookCourier(orderId, provider, { fromRetry: true })
  }
}
