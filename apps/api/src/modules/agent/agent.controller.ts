import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import { Public } from '../../common/auth/public.decorator'
import { AgentService } from './agent.service'
import type { AgentModelId } from './agent.types'

@Controller('agent')
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Post('chat')
  async chat(
    @Query('storeId') storeId: string,
    @Body() body: { sessionId: string; message: string; stream?: boolean; context?: string },
    @Res() res: Response,
  ) {
    const sessionId = body.sessionId || `session_${Date.now()}`
    const stream = body.stream !== false

    if (!stream) {
      let text = ''
      for await (const event of this.agent.chatStream(storeId, sessionId, body.message, undefined, body.context)) {
        if (event.type === 'token') text += event.content ?? ''
      }
      res.json({ sessionId, message: text })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()

    try {
      for await (const event of this.agent.chatStream(storeId, sessionId, body.message, undefined, body.context)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Chat failed'
      res.write(`data: ${JSON.stringify({ type: 'error', content: message })}\n\n`)
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
    res.end()
  }

  @Get('chat/:sessionId')
  getHistory(@Query('storeId') storeId: string, @Param('sessionId') sessionId: string) {
    return this.agent.getHistory(storeId, sessionId)
  }

  @Delete('sessions/:sessionId')
  clearSession(@Query('storeId') storeId: string, @Param('sessionId') sessionId: string) {
    return this.agent.clearSession(storeId, sessionId)
  }

  @Get('status')
  getStatus(@Query('storeId') storeId: string) {
    return this.agent.getStatus(storeId)
  }

  @Post('telegram/test')
  testTelegram(
    @Query('storeId') storeId: string,
    @Body() body: { message?: string },
  ) {
    return this.agent.testTelegram(storeId, body)
  }

  @Get('health')
  getHealth(@Query('storeId') storeId: string) {
    return this.agent.getHealth(storeId)
  }

  @Get('config')
  getConfig(@Query('storeId') storeId: string) {
    return this.agent.getConfig(storeId)
  }

  @Post('config')
  updateConfig(@Query('storeId') storeId: string, @Body() body: Record<string, unknown>) {
    return this.agent.updateConfig(storeId, body)
  }

  @Post('model')
  switchModel(@Query('storeId') storeId: string, @Body() body: { model: AgentModelId }) {
    return this.agent.switchModel(storeId, body.model)
  }

  @Get('prompts')
  listPrompts(@Query('storeId') storeId: string) {
    return this.agent.listPromptVersions(storeId)
  }

  @Post('prompts')
  updatePrompt(
    @Query('storeId') storeId: string,
    @Body() body: { prompt: string; reason?: string },
  ) {
    return this.agent.updateConfig(storeId, { systemPrompt: body.prompt })
  }

  @Public()
  @Post('telegram/webhook')
  async telegramWebhook(
    @Query('storeId') storeId: string,
    @Body() body: { message?: { chat?: { id?: number }; text?: string } },
  ) {
    const chatId = body.message?.chat?.id
    const text = body.message?.text?.trim()
    if (!chatId || !text) return { ok: true }

    if (text.startsWith('/status')) {
      const health = await this.agent.getHealth(storeId)
      return { text: `📊 Orders today: ${health.ordersToday}\n💰 Revenue: ৳${health.revenueToday.toLocaleString()}\n⚠ Low stock: ${health.lowStockCount}` }
    }

    const reply = await this.agent.handleTelegramMessage(storeId, String(chatId), text)
    return { text: reply }
  }
}
