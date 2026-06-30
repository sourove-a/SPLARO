import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import type { FinanceAuditAction } from '@prisma/client'

@Injectable()
export class FinanceAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    storeId: string
    action: FinanceAuditAction
    resource: string
    resourceId?: string
    before?: unknown
    after?: unknown
    note?: string
    userId?: string
    ipAddress?: string
  }): Promise<void> {
    await this.prisma.financeAuditLog.create({
      data: {
        storeId: params.storeId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        before: params.before as object | undefined,
        after: params.after as object | undefined,
        note: params.note,
        userId: params.userId,
        ipAddress: params.ipAddress,
      },
    })
  }
}
