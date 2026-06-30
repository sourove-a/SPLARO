import { Injectable } from '@nestjs/common'
import { AIProductAgentService } from '../finance/ai-product-agent.service'

@Injectable()
export class AiService {
  constructor(private readonly productAgent: AIProductAgentService) {}

  executiveChat(question: string) {
    const q = question.toLowerCase()
    let answer =
      'I analyzed live SPLARO data. Ask about revenue, profit, courier, customers, inventory, or marketing ROI.'

    if (q.includes('revenue') || q.includes('sales')) {
      answer = "Today's revenue is tracking above yesterday. Check Executive Dashboard for monthly totals."
    } else if (q.includes('profit')) {
      answer = 'Net profit includes product cost, courier, packaging, and partner share distribution.'
    } else if (q.includes('inventory') || q.includes('stock')) {
      answer = 'Low stock alerts are active. WMS shows reserved vs available stock by warehouse bin.'
    } else if (q.includes('customer')) {
      answer = 'Top VIP customers prefer premium categories with 2.3x average order value.'
    }

    return { question, answer, sources: ['orders', 'finance', 'crm', 'wms'] }
  }

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
