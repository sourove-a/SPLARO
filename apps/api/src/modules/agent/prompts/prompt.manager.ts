import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../common/prisma.service'
import { DEFAULT_AGENT_SYSTEM_PROMPT } from './system.prompt'
import { PLATFORM_KNOWLEDGE_PROMPT } from './platform-knowledge.prompt'
import { PLATFORM_KNOWLEDGE_COMPACT } from './platform-knowledge-compact.prompt'

@Injectable()
export class PromptManager {
  constructor(private readonly prisma: PrismaService) {}

  async getSystemPrompt(storeId: string, opts?: { compact?: boolean }): Promise<string> {
    const config = await this.prisma.agentConfig.findUnique({ where: { storeId } })
    const custom = config?.systemPrompt?.trim() || DEFAULT_AGENT_SYSTEM_PROMPT
    const knowledge = opts?.compact ? PLATFORM_KNOWLEDGE_COMPACT : PLATFORM_KNOWLEDGE_PROMPT
    return `${custom}\n\n---\n${knowledge}`
  }

  async updateSystemPrompt(
    storeId: string,
    prompt: string,
    reason?: string,
    createdBy?: string,
  ): Promise<void> {
    const trimmed = prompt.trim()
    if (!trimmed) throw new Error('Prompt cannot be empty')

    await this.prisma.$transaction([
      this.prisma.agentConfig.upsert({
        where: { storeId },
        create: { storeId, systemPrompt: trimmed },
        update: { systemPrompt: trimmed },
      }),
      this.prisma.agentPromptVersion.create({
        data: {
          storeId,
          prompt: trimmed,
          reason: reason ?? null,
          createdBy: createdBy ?? null,
        },
      }),
    ])
  }

  async listVersions(storeId: string, limit = 20) {
    return this.prisma.agentPromptVersion.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }
}
