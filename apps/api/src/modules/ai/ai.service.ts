import { Injectable } from '@nestjs/common'
import { AIProductAgentService } from '../finance/ai-product-agent.service'

@Injectable()
export class AiService {
  constructor(private readonly productAgent: AIProductAgentService) {}

  listProductAgentJobs(storeId: string, page = 1, limit = 20) {
    return this.productAgent.listJobs(storeId, page, limit)
  }

  generateProductListing(
    storeId: string,
    input: Record<string, unknown>,
    createdBy?: string,
  ) {
    return this.productAgent.createJob(storeId, input as never, createdBy)
  }

  approveProductAgentJob(id: string, storeId: string, reviewedBy?: string, notes?: string) {
    return this.productAgent.approveJob(id, storeId, reviewedBy, notes)
  }

  rejectProductAgentJob(id: string, storeId: string, reviewedBy?: string, notes?: string) {
    return this.productAgent.rejectJob(id, storeId, reviewedBy, notes)
  }
}
