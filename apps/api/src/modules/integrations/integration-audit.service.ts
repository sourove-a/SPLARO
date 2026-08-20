import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { TELEGRAM_TEST_SUCCESS_WINDOW_MS } from '../platform/system-log.util'

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
    if (params.success && params.provider === 'telegram') {
      const recent = await this.prisma.auditLog.findFirst({
        where: {
          storeId: params.storeId,
          module: 'integrations',
          resource: 'telegram',
          action: 'TEST_SUCCESS',
          createdAt: { gte: new Date(Date.now() - TELEGRAM_TEST_SUCCESS_WINDOW_MS) },
        },
        orderBy: { createdAt: 'desc' },
      })
      if (recent) {
        const prev =
          recent.newData && typeof recent.newData === 'object' && !Array.isArray(recent.newData)
            ? (recent.newData as Record<string, unknown>)
            : {}
        const repeatCount = (typeof prev.repeatCount === 'number' ? prev.repeatCount : 1) + 1
        const newData: Prisma.InputJsonValue = {
          ...prev,
          message: params.message,
          success: true,
          repeatCount,
        }
        await this.prisma.auditLog.update({
          where: { id: recent.id },
          data: { newData },
        })
        return
      }
    }
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
