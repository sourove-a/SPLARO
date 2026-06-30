import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../common/prisma.service'
import { RedisService } from '../../../common/redis.service'
import type { AgentMessage } from '../agent.types'

const HISTORY_LIMIT = 20
const REDIS_TTL_SEC = 86_400

@Injectable()
export class ConversationStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private cacheKey(storeId: string, sessionId: string) {
    return `agent:conv:${storeId}:${sessionId}`
  }

  async append(
    storeId: string,
    sessionId: string,
    role: string,
    content: string,
    toolCalls?: unknown,
  ): Promise<void> {
    await this.prisma.agentConversation.create({
      data: {
        storeId,
        sessionId,
        role,
        content,
        toolCalls: toolCalls ? (toolCalls as object) : undefined,
      },
    })

    const history = await this.getHistory(storeId, sessionId, HISTORY_LIMIT)
    await this.redis.setJson(this.cacheKey(storeId, sessionId), history, REDIS_TTL_SEC)
  }

  async getHistory(storeId: string, sessionId: string, limit = HISTORY_LIMIT): Promise<AgentMessage[]> {
    const cached = await this.redis.getJson<AgentMessage[]>(this.cacheKey(storeId, sessionId))
    if (cached?.length) return cached.slice(-limit)

    const rows = await this.prisma.agentConversation.findMany({
      where: { storeId, sessionId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })

    const messages: AgentMessage[] = rows.map((row) => ({
      role: row.role as AgentMessage['role'],
      content: row.content,
    }))

    if (messages.length) {
      await this.redis.setJson(this.cacheKey(storeId, sessionId), messages, REDIS_TTL_SEC)
    }

    return messages
  }

  async clearSession(storeId: string, sessionId: string): Promise<void> {
    await this.prisma.agentConversation.deleteMany({ where: { storeId, sessionId } })
    await this.redis.del(this.cacheKey(storeId, sessionId))
  }
}
