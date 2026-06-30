import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'

@Injectable()
export class GoogleAuditService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveUserId(userId?: string): Promise<string | null> {
    if (!userId) return null
    const row = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    return row?.id ?? null
  }

  async log(params: {
    storeId: string
    action: string
    service?: string
    resource?: string
    resourceId?: string
    message?: string
    metadata?: Record<string, unknown>
    userId?: string
    ipAddress?: string
  }) {
    await this.prisma.googleAuditLog.create({
      data: {
        storeId: params.storeId,
        action: params.action,
        service: params.service ?? null,
        resource: params.resource ?? null,
        resourceId: params.resourceId ?? null,
        message: params.message ?? null,
        metadata: params.metadata as object,
        userId: await this.resolveUserId(params.userId),
        ipAddress: params.ipAddress ?? null,
      },
    })
  }
}
