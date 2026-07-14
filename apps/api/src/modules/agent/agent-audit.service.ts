import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import type { AgentDifficulty } from './agent-difficulty'
import type { ToolTier } from './tool-registry'

@Injectable()
export class AgentAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async startRun(input: {
    storeId: string
    sessionId: string
    channel: 'admin' | 'telegram'
    model: string
    difficulty: AgentDifficulty
    userMessage: string
  }) {
    return this.prisma.agentRun.create({
      data: {
        storeId: input.storeId,
        sessionId: input.sessionId,
        channel: input.channel,
        model: input.model,
        difficulty: input.difficulty,
        userMessage: input.userMessage,
        status: 'running',
      },
    })
  }

  async finishRun(
    runId: string,
    status: 'completed' | 'failed' | 'budget_refused',
    totals: { tokenInEst: number; tokenOutEst: number; costEstUsd: number },
  ) {
    return this.prisma.agentRun.update({
      where: { id: runId },
      data: {
        status,
        tokenInEst: totals.tokenInEst,
        tokenOutEst: totals.tokenOutEst,
        costEstUsd: new Prisma.Decimal(totals.costEstUsd),
        finishedAt: new Date(),
      },
    })
  }

  async logToolCall(input: {
    runId: string
    toolName: string
    tier: ToolTier
    input: Record<string, unknown>
    resultSummary: string
    previousValues?: Record<string, unknown> | null
    confirmed?: boolean
    costEstUsd?: number
  }) {
    return this.prisma.agentToolCall.create({
      data: {
        runId: input.runId,
        toolName: input.toolName,
        tier: input.tier,
        input: input.input as Prisma.InputJsonValue,
        resultSummary: input.resultSummary.slice(0, 4000),
        previousValues: input.previousValues
          ? (input.previousValues as Prisma.InputJsonValue)
          : undefined,
        confirmed: input.confirmed ?? false,
        costEstUsd: new Prisma.Decimal(input.costEstUsd ?? 0),
      },
    })
  }

  async listActivity(storeId: string, limit = 50) {
    const runs = await this.prisma.agentRun.findMany({
      where: { storeId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        toolCalls: { orderBy: { createdAt: 'asc' }, take: 20 },
      },
    })
    return runs.map((run) => ({
      id: run.id,
      sessionId: run.sessionId,
      channel: run.channel,
      model: run.model,
      difficulty: run.difficulty,
      status: run.status,
      userMessage: run.userMessage.slice(0, 200),
      tokenInEst: run.tokenInEst,
      tokenOutEst: run.tokenOutEst,
      costEstUsd: Number(run.costEstUsd),
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      toolCalls: run.toolCalls.map((tc) => ({
        id: tc.id,
        toolName: tc.toolName,
        tier: tc.tier,
        confirmed: tc.confirmed,
        resultSummary: tc.resultSummary.slice(0, 300),
        createdAt: tc.createdAt,
      })),
    }))
  }
}
