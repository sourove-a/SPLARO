import { Injectable, Logger } from '@nestjs/common'
import { AgentAuditService } from './agent-audit.service'
import { AgentConfirmationsService } from './agent-confirmations.service'
import { AgentCostService } from './agent-cost.service'
import {
  filterToolsToDefinitions,
  isCancelMessage,
  isConfirmMessage,
  mandatoryReadToolForMessage,
  truncateToolResult,
  trimHistory,
} from './agent-context'
import { routeByDifficulty } from './agent-difficulty'
import { ModelRouter } from './providers/model-router'
import type { AgentModelId } from './agent.types'
import { AgentToolsService } from './tools/agent-tools.service'
import { getToolTier, toolRequiresConfirm } from './tool-registry'
import type { AgentMessage, AgentStreamEvent } from './agent.types'

const RETRY_DELAYS_MS = [500, 1500]

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export interface AgentLoopResult {
  finalText: string
  tokenInEst: number
  tokenOutEst: number
  costEstUsd: number
}

@Injectable()
export class AgentLoopService {
  private readonly logger = new Logger(AgentLoopService.name)

  constructor(
    private readonly router: ModelRouter,
    private readonly tools: AgentToolsService,
    private readonly audit: AgentAuditService,
    private readonly confirmations: AgentConfirmationsService,
    private readonly cost: AgentCostService,
  ) {}

  async *run(input: {
    storeId: string
    sessionId: string
    userMessage: string
    systemPrompt: string
    history: AgentMessage[]
    createdBy?: string
    channel: 'admin' | 'telegram'
  }): AsyncGenerator<AgentStreamEvent, AgentLoopResult | void> {
    const { storeId, sessionId, userMessage, systemPrompt, history, createdBy, channel } = input
    const trimmed = userMessage.trim()
    let finalText = ''
    let tokenInEst = 0
    let tokenOutEst = 0
    let costEstUsd = 0

    if (await this.cost.isOverDailyBudget(storeId)) {
      yield {
        type: 'budget_exceeded',
        content:
          'আজকের AI budget শেষ — AGENT_DAILY_COST_LIMIT_USD পার হয়ে গেছে। কাল আবার চেষ্টা করুন বা limit বাড়ান।',
      }
      return { finalText: '', tokenInEst: 0, tokenOutEst: 0, costEstUsd: 0 }
    }

    const spentUsd = await this.cost.getDailySpendUsd(storeId)
    const limitUsd = this.cost.dailyCostLimitUsd()
    if (limitUsd > 0 && spentUsd / limitUsd >= 0.8 && spentUsd < limitUsd) {
      const pct = Math.round((spentUsd / limitUsd) * 100)
      yield {
        type: 'token',
        content: `⚠ AI budget ~${pct}% today ($${spentUsd.toFixed(3)} / $${limitUsd}). Soft warn — hard refuse at 100%.\n\n`,
      }
    }

    if (isConfirmMessage(trimmed)) {
      const confirmed = await this.confirmations.confirmPending(storeId, sessionId)
      if (!confirmed) {
        yield { type: 'error', content: 'কোনো pending action নেই।' }
        return { finalText: '', tokenInEst: 0, tokenOutEst: 0, costEstUsd: 0 }
      }

      const run = await this.audit.startRun({
        storeId,
        sessionId,
        channel,
        model: 'confirm',
        difficulty: 'lookup',
        userMessage: `confirm:${confirmed.toolName}`,
      })

      yield { type: 'tool_start', toolName: confirmed.toolName }
      let toolResult: unknown
      try {
        toolResult = await this.tools.execute(
          storeId,
          sessionId,
          confirmed.toolName,
          confirmed.arguments,
          createdBy,
          { confirmed: true, previousValues: confirmed.previousValues },
        )
      } catch (err) {
        toolResult = { ok: false, error: err instanceof Error ? err.message : 'Tool failed' }
      }

      const tier = getToolTier(confirmed.toolName)
      const truncated = truncateToolResult(confirmed.toolName, toolResult)
      await this.audit.logToolCall({
        runId: run.id,
        toolName: confirmed.toolName,
        tier,
        input: confirmed.arguments,
        resultSummary: truncated,
        previousValues: confirmed.previousValues,
        confirmed: true,
      })

      yield { type: 'tool_end', toolName: confirmed.toolName, toolResult }
      finalText = this.tools.summarizeResult(toolResult)
      for (const char of finalText) yield { type: 'token', content: char }
      yield* this.emitCost(tokenInEst, tokenOutEst, costEstUsd)
      await this.audit.finishRun(run.id, 'completed', { tokenInEst, tokenOutEst, costEstUsd })
      yield { type: 'done' }
      return { finalText, tokenInEst, tokenOutEst, costEstUsd }
    }

    if (isCancelMessage(trimmed)) {
      await this.confirmations.cancelPending(storeId, sessionId)
      finalText = 'Action cancelled — কিছু execute হয়নি।'
      for (const char of finalText) yield { type: 'token', content: char }
      yield { type: 'done' }
      return { finalText, tokenInEst, tokenOutEst, costEstUsd }
    }

    const difficulty = routeByDifficulty(trimmed)
    const mandatoryTool = mandatoryReadToolForMessage(trimmed)
    const toolDefs = filterToolsToDefinitions(trimmed).filter((tool) => tool.name !== mandatoryTool)

    let provider: Awaited<ReturnType<ModelRouter['getProviderForDifficulty']>>['provider']
    let apiKey: string
    let model: AgentModelId
    let providerOptions: Awaited<ReturnType<ModelRouter['getProviderForDifficulty']>>['providerOptions']

    try {
      ;({ provider, apiKey, model, providerOptions } = await this.router.getProviderForDifficulty(
        storeId,
        difficulty,
      ))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Model not configured'
      yield { type: 'error', content: msg }
      return { finalText: '', tokenInEst: 0, tokenOutEst: 0, costEstUsd: 0 }
    }

    const modelId = providerOptions?.model ?? model

    const run = await this.audit.startRun({
      storeId,
      sessionId,
      channel,
      model: modelId,
      difficulty,
      userMessage: trimmed,
    })

    const messages: AgentMessage[] = [
      { role: 'system', content: systemPrompt },
      ...trimHistory(history),
    ]

    if (mandatoryTool) {
      yield { type: 'tool_start', toolName: mandatoryTool }
      const { result, summary } = await this.runMandatoryReadTool(
        storeId,
        sessionId,
        mandatoryTool,
        createdBy,
        run.id,
      )
      yield { type: 'tool_end', toolName: mandatoryTool, toolResult: result }
      messages.push({
        role: 'system',
        content:
          `VERIFIED LIVE DATA from ${mandatoryTool}:\n${summary}\n\n` +
          'Answer the user from this live result now. Mention concrete findings and counts. ' +
          'Do not greet, ask how you can help, or claim anything not present in the result.',
      })
    }

    messages.push({ role: 'user', content: trimmed })

    tokenInEst = this.cost.estimateTokensFromText(JSON.stringify(messages))
    let iterations = 0
    const maxIter = this.cost.maxToolIterations()

    try {
      while (iterations < maxIter) {
        iterations += 1
        if (tokenInEst + tokenOutEst > this.cost.maxTokensPerRun()) {
          finalText =
            'Token budget reached — আংশিক কাজ হয়েছে। ছোট request দিন বা AGENT_MAX_TOKENS_PER_RUN বাড়ান।'
          break
        }

        let result
        let lastErr: Error | null = null
        for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
          try {
            result = await provider.chat(messages, toolDefs, apiKey, providerOptions)
            lastErr = null
            break
          } catch (err) {
            lastErr = err instanceof Error ? err : new Error('Model request failed')
            if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt] ?? 500)
          }
        }

        if (lastErr || !result) {
          yield { type: 'error', content: lastErr?.message ?? 'Model request failed' }
          costEstUsd = this.cost.estimateCostUsd(modelId, tokenInEst, tokenOutEst)
          await this.audit.finishRun(run.id, 'failed', { tokenInEst, tokenOutEst, costEstUsd })
          return { finalText: '', tokenInEst, tokenOutEst, costEstUsd }
        }

        tokenOutEst += this.cost.estimateTokensFromText(result.content ?? '')

        if (result.toolCalls.length === 0) {
          finalText = result.content
          break
        }

        messages.push({
          role: 'assistant',
          content: result.content ?? '',
          toolCalls: result.toolCalls,
        })

        for (const call of result.toolCalls) {
          if (toolRequiresConfirm(call.name, call.arguments)) {
            const preview = this.confirmations.buildDangerousPreview(call.name, call.arguments)
            const previousValues = await this.tools.capturePreviousValues(storeId, call.name, call.arguments)
            const pending = await this.confirmations.createPending({
              storeId,
              sessionId,
              toolName: call.name,
              arguments: call.arguments,
              preview,
              previousValues,
            })
            yield {
              type: 'confirm_required',
              content: preview,
              pendingId: pending.id,
              toolName: call.name,
            }
            finalText = `${preview}\n\nType **confirm** to execute.`
            for (const char of finalText) yield { type: 'token', content: char }
            costEstUsd = this.cost.estimateCostUsd(modelId, tokenInEst, tokenOutEst)
            yield* this.emitCost(tokenInEst, tokenOutEst, costEstUsd)
            await this.audit.finishRun(run.id, 'completed', { tokenInEst, tokenOutEst, costEstUsd })
            yield { type: 'done' }
            return { finalText, tokenInEst, tokenOutEst, costEstUsd }
          }

          yield { type: 'tool_start', toolName: call.name }
          const tier = getToolTier(call.name)
          const cacheKey =
            tier === 'READ' ? this.cost.getReadCacheKey(storeId, trimmed, call.name, call.arguments) : null

          let toolResult: unknown
          if (cacheKey) {
            const cached = this.cost.getCachedRead(cacheKey)
            if (cached) toolResult = { cached: true, data: JSON.parse(cached) }
          }

          if (!toolResult) {
            try {
              toolResult = await this.tools.execute(storeId, sessionId, call.name, call.arguments, createdBy)
            } catch (err) {
              toolResult = { error: err instanceof Error ? err.message : 'Tool failed' }
            }
            if (cacheKey && !(toolResult as { error?: string }).error) {
              this.cost.setCachedRead(cacheKey, JSON.stringify(toolResult))
            }
          }

          const truncated = truncateToolResult(call.name, toolResult)
          yield { type: 'tool_end', toolName: call.name, toolResult }

          await this.audit.logToolCall({
            runId: run.id,
            toolName: call.name,
            tier,
            input: call.arguments,
            resultSummary: truncated,
            previousValues: await this.tools.capturePreviousValues(storeId, call.name, call.arguments),
            // Only DANGEROUS confirm-path sets confirmed:true — WRITE alone is not "confirmed"
            confirmed: false,
          })

          messages.push({
            role: 'tool',
            content: truncated,
            name: call.name,
            toolCallId: call.id,
          })
          tokenInEst += this.cost.estimateTokensFromText(truncated)
        }
      }

      if (!finalText) {
        try {
          for await (const token of provider.streamText(messages, apiKey, providerOptions)) {
            finalText += token
            tokenOutEst += 1
            yield { type: 'token', content: token }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Response stream failed'
          yield { type: 'error', content: msg }
          costEstUsd = this.cost.estimateCostUsd(modelId, tokenInEst, tokenOutEst)
          await this.audit.finishRun(run.id, 'failed', { tokenInEst, tokenOutEst, costEstUsd })
          return { finalText: '', tokenInEst, tokenOutEst, costEstUsd }
        }
      } else {
        for (const char of finalText) yield { type: 'token', content: char }
      }

      costEstUsd = this.cost.estimateCostUsd(modelId, tokenInEst, tokenOutEst)
      yield* this.emitCost(tokenInEst, tokenOutEst, costEstUsd)
      await this.audit.finishRun(run.id, 'completed', { tokenInEst, tokenOutEst, costEstUsd })
      yield { type: 'done' }
      return { finalText, tokenInEst, tokenOutEst, costEstUsd }
    } catch (err) {
      this.logger.error(err instanceof Error ? err.message : err)
      costEstUsd = this.cost.estimateCostUsd(modelId, tokenInEst, tokenOutEst)
      await this.audit.finishRun(run.id, 'failed', { tokenInEst, tokenOutEst, costEstUsd })
      throw err
    }
  }

  private async runMandatoryReadTool(
    storeId: string,
    sessionId: string,
    toolName: string,
    createdBy: string | undefined,
    runId: string,
  ): Promise<{ result: unknown; summary: string }> {
    let result: unknown
    try {
      result = await this.tools.execute(storeId, sessionId, toolName, {}, createdBy)
    } catch (err) {
      result = { error: err instanceof Error ? err.message : 'Diagnostic tool failed' }
    }

    const summary = truncateToolResult(toolName, result)
    await this.audit.logToolCall({
      runId,
      toolName,
      tier: 'READ',
      input: {},
      resultSummary: summary,
      confirmed: false,
    })
    return { result, summary }
  }

  private *emitCost(
    tokenInEst: number,
    tokenOutEst: number,
    costEstUsd: number,
  ): Generator<AgentStreamEvent> {
    yield {
      type: 'cost',
      content: `~${tokenInEst + tokenOutEst} tokens · ~$${costEstUsd.toFixed(4)}`,
      tokenInEst,
      tokenOutEst,
      costEstUsd,
    }
  }
}
