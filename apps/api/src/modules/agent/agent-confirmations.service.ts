import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { getToolEntry } from './tool-registry'

const PENDING_TTL_MS = 10 * 60 * 1000

@Injectable()
export class AgentConfirmationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPending(storeId: string, sessionId: string) {
    await this.expireOld(storeId, sessionId)
    return this.prisma.agentPendingAction.findFirst({
      where: { storeId, sessionId, status: 'pending', expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async createPending(input: {
    storeId: string
    sessionId: string
    toolName: string
    arguments: Record<string, unknown>
    preview: string
    previousValues?: Record<string, unknown> | null
  }) {
    await this.cancelAllPending(input.storeId, input.sessionId)
    return this.prisma.agentPendingAction.create({
      data: {
        storeId: input.storeId,
        sessionId: input.sessionId,
        toolName: input.toolName,
        arguments: input.arguments as Prisma.InputJsonValue,
        preview: input.preview.slice(0, 4000),
        previousValues: input.previousValues
          ? (input.previousValues as Prisma.InputJsonValue)
          : undefined,
        expiresAt: new Date(Date.now() + PENDING_TTL_MS),
        status: 'pending',
      },
    })
  }

  async confirmPending(storeId: string, sessionId: string, pendingId?: string) {
    const pending = pendingId
      ? await this.prisma.agentPendingAction.findFirst({
          where: { id: pendingId, storeId, sessionId, status: 'pending' },
        })
      : await this.getPending(storeId, sessionId)

    if (!pending || pending.expiresAt < new Date()) {
      return null
    }

    await this.prisma.agentPendingAction.update({
      where: { id: pending.id },
      data: { status: 'confirmed' },
    })

    return {
      id: pending.id,
      toolName: pending.toolName,
      arguments: pending.arguments as Record<string, unknown>,
      preview: pending.preview,
      previousValues: pending.previousValues as Record<string, unknown> | null,
    }
  }

  async cancelPending(storeId: string, sessionId: string) {
    await this.cancelAllPending(storeId, sessionId)
    return { cancelled: true }
  }

  buildDangerousPreview(toolName: string, args: Record<string, unknown>): string {
    const entry = getToolEntry(toolName)
    const tierLabel =
      toolName === 'update_product' && entry?.tier === 'WRITE'
        ? 'WRITE → confirm (price/publish/stock)'
        : entry?.tier ?? 'DANGEROUS'
    const lines = [`Tool: ${toolName}`, `Tier: ${tierLabel}`]
    for (const [k, v] of Object.entries(args)) {
      if (v !== undefined && v !== null && v !== '') {
        lines.push(`${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      }
    }
    lines.push('', 'Reply **confirm** (or Confirm button) to execute, or **cancel** to abort.')
    return lines.join('\n')
  }

  private async cancelAllPending(storeId: string, sessionId: string) {
    await this.prisma.agentPendingAction.updateMany({
      where: { storeId, sessionId, status: 'pending' },
      data: { status: 'cancelled' },
    })
  }

  private async expireOld(storeId: string, sessionId: string) {
    await this.prisma.agentPendingAction.updateMany({
      where: { storeId, sessionId, status: 'pending', expiresAt: { lt: new Date() } },
      data: { status: 'expired' },
    })
  }
}
