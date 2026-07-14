import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../common/prisma.service'

/** Rough USD per 1M tokens — estimates only for budget display. */
const MODEL_RATES: Record<string, { in: number; out: number }> = {
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'gpt-4o': { in: 2.5, out: 10 },
  'claude-3-5-haiku-20241022': { in: 0.25, out: 1.25 },
  'claude-3-5-sonnet-20241022': { in: 3, out: 15 },
  'gemini-2.0-flash': { in: 0.1, out: 0.4 },
  'grok-2-1212': { in: 2, out: 10 },
  default: { in: 1, out: 3 },
}

interface ReadCacheEntry {
  at: number
  answer: string
}

@Injectable()
export class AgentCostService {
  private readonly readCache = new Map<string, ReadCacheEntry>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  maxToolIterations(): number {
    return Number(this.config.get('AGENT_MAX_TOOL_ITERATIONS') ?? 10)
  }

  maxTokensPerRun(): number {
    return Number(this.config.get('AGENT_MAX_TOKENS_PER_RUN') ?? 8000)
  }

  dailyCostLimitUsd(): number {
    return Number(this.config.get('AGENT_DAILY_COST_LIMIT_USD') ?? 2)
  }

  readCacheTtlMs(): number {
    return Number(this.config.get('AGENT_READ_CACHE_TTL_SEC') ?? 120) * 1000
  }

  estimateCostUsd(modelId: string | undefined, tokenIn: number, tokenOut: number): number {
    const rates = MODEL_RATES[modelId ?? ''] ?? MODEL_RATES.default
    return (tokenIn / 1_000_000) * rates.in + (tokenOut / 1_000_000) * rates.out
  }

  estimateTokensFromText(text: string): number {
    return Math.ceil(text.length / 4)
  }

  async getDailySpendUsd(storeId: string): Promise<number> {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    try {
      const agg = await this.prisma.agentRun.aggregate({
        where: { storeId, startedAt: { gte: start }, status: { not: 'budget_refused' } },
        _sum: { costEstUsd: true },
      })
      return Number(agg._sum.costEstUsd ?? 0)
    } catch {
      return 0
    }
  }

  async isOverDailyBudget(storeId: string): Promise<boolean> {
    const limit = this.dailyCostLimitUsd()
    if (limit <= 0) return false
    const spent = await this.getDailySpendUsd(storeId)
    return spent >= limit
  }

  getReadCacheKey(storeId: string, message: string, toolName: string, args: Record<string, unknown>): string {
    const norm = message.trim().toLowerCase().replace(/\s+/g, ' ')
    return `${storeId}:${norm}:${toolName}:${JSON.stringify(args)}`
  }

  getCachedRead(key: string): string | null {
    const entry = this.readCache.get(key)
    if (!entry) return null
    if (Date.now() - entry.at > this.readCacheTtlMs()) {
      this.readCache.delete(key)
      return null
    }
    return entry.answer
  }

  setCachedRead(key: string, answer: string): void {
    this.readCache.set(key, { at: Date.now(), answer })
    if (this.readCache.size > 200) {
      const oldest = [...this.readCache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
      if (oldest) this.readCache.delete(oldest[0])
    }
  }
}
