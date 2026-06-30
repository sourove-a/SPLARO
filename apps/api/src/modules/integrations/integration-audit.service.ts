import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'

@Injectable()
export class IntegrationAuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Session user ids (e.g. admin_env_user) may not exist in User table — skip FK. */
  private async resolveUserId(userId?: string): Promise<string | null> {
    if (!userId) return null
    const row = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    return row?.id ?? null
  }

  async logSave(params: {
    storeId: string
    userId?: string
    provider: string
    resource: string
    resourceId?: string
    newData?: Record<string, unknown>
    ipAddress?: string
  }) {
    const userId = await this.resolveUserId(params.userId)
    await this.prisma.auditLog.create({
      data: {
        storeId: params.storeId,
        userId,
        action: 'UPDATE',
        module: 'integrations',
        resource: params.resource,
        resourceId: params.resourceId ?? params.provider,
        newData: params.newData as object,
        ipAddress: params.ipAddress ?? null,
        source: 'WEB',
      },
    })
  }

  async logTest(params: {
    storeId: string
    userId?: string
    provider: string
    success: boolean
    message: string
  }) {
    const userId = await this.resolveUserId(params.userId)
    await this.prisma.auditLog.create({
      data: {
        storeId: params.storeId,
        userId,
        action: params.success ? 'TEST_SUCCESS' : 'TEST_FAILED',
        module: 'integrations',
        resource: params.provider,
        resourceId: params.provider,
        newData: { message: params.message, success: params.success },
        source: 'WEB',
      },
    })
  }
}
