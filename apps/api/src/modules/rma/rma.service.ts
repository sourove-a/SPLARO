import { Injectable } from '@nestjs/common'
import type { RMAStatus, RMAType } from '@prisma/client'
import { CommerceFinanceService } from '../commerce-finance/commerce-finance.service'

@Injectable()
export class RmaService {
  constructor(private readonly finance: CommerceFinanceService) {}

  list(storeId?: string, search?: string) {
    return this.finance.listReturns(storeId, search)
  }

  create(
    storeId: string,
    body: {
      orderId: string
      type?: RMAType
      reason: string
      description?: string
      customerId?: string
    },
  ) {
    return this.finance.createReturn(storeId, body)
  }

  updateStatus(
    storeId: string,
    id: string,
    body: { status: RMAStatus; note?: string; refundAmount?: number },
  ) {
    return this.finance.updateReturnStatus(storeId, id, body)
  }
}
