import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  GoneException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request, Response } from 'express'
import { Public } from '../../common/auth/public.decorator'
import { RequireFeature } from '../../common/auth/require-feature.decorator'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import {
  AgentChatDto,
  AgentConfigDto,
  AgentPromptDto,
  AgentSwitchModelDto,
  AgentTelegramTestDto,
} from '../../common/dtos/agent.dto'
import { AgentService } from './agent.service'
import { resolveAgentStoreId } from './agent-store.util'
import { PrismaService } from '../../common/prisma.service'

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

@RequireFeature('ai')
@Controller('agent')
export class AgentController {
  constructor(
    private readonly agent: AgentService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private async storeId(req: AdminRequest, queryStoreId?: string) {
    return resolveAgentStoreId(this.prisma, queryStoreId, req)
  }

  @Post('chat')
  async chat(
    @Query('storeId') storeId: string,
    @Body() body: AgentChatDto,
    @Req() req: AdminRequest,
    @Res() res: Response,
  ) {
    const resolvedStore = await this.storeId(req, storeId)
    const sessionId = body.sessionId?.trim() || `session_${Date.now()}`
    const stream = body.stream !== false
    const message = body.message.trim()

    if (!stream) {
      let text = ''
      for await (const event of this.agent.chatStream(resolvedStore, sessionId, message, req.adminUser?.email, body.context)) {
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
      for await (const event of this.agent.chatStream(
        resolvedStore,
        sessionId,
        message,
        req.adminUser?.email,
        body.context,
      )) {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
      }
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : 'Chat failed'
      res.write(`data: ${JSON.stringify({ type: 'error', content: errMessage })}\n\n`)
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
    res.end()
  }

  @Get('chat/:sessionId')
  async getHistory(
    @Query('storeId') storeId: string,
    @Param('sessionId') sessionId: string,
    @Req() req: AdminRequest,
  ) {
    return this.agent.getHistory(await this.storeId(req, storeId), sessionId)
  }

  @Delete('sessions/:sessionId')
  async clearSession(
    @Query('storeId') storeId: string,
    @Param('sessionId') sessionId: string,
    @Req() req: AdminRequest,
  ) {
    return this.agent.clearSession(await this.storeId(req, storeId), sessionId)
  }

  @Get('status')
  async getStatus(@Query('storeId') storeId: string, @Req() req: AdminRequest) {
    return this.agent.getStatus(await this.storeId(req, storeId))
  }

  @Get('activity')
  async getActivity(
    @Query('storeId') storeId: string,
    @Query('limit') limit: string | undefined,
    @Req() req: AdminRequest,
  ) {
    const n = limit ? Math.min(Number(limit) || 50, 100) : 50
    return this.agent.listActivity(await this.storeId(req, storeId), n)
  }

  @Post('telegram/test')
  async testTelegram(
    @Query('storeId') storeId: string,
    @Body() body: AgentTelegramTestDto,
    @Req() req: AdminRequest,
  ) {
    return this.agent.testTelegram(await this.storeId(req, storeId), body)
  }

  @Get('health')
  async getHealth(@Query('storeId') storeId: string, @Req() req: AdminRequest) {
    return this.agent.getHealth(await this.storeId(req, storeId))
  }

  @Get('config')
  async getConfig(@Query('storeId') storeId: string, @Req() req: AdminRequest) {
    return this.agent.getConfig(await this.storeId(req, storeId))
  }

  @Post('config')
  async updateConfig(
    @Query('storeId') storeId: string,
    @Body() body: AgentConfigDto,
    @Req() req: AdminRequest,
  ) {
    return this.agent.updateConfig(await this.storeId(req, storeId), body as Record<string, unknown>)
  }

  @Post('model')
  async switchModel(
    @Query('storeId') storeId: string,
    @Body() body: AgentSwitchModelDto,
    @Req() req: AdminRequest,
  ) {
    return this.agent.switchModel(await this.storeId(req, storeId), body.model)
  }

  @Get('prompts')
  async listPrompts(@Query('storeId') storeId: string, @Req() req: AdminRequest) {
    return this.agent.listPromptVersions(await this.storeId(req, storeId))
  }

  @Post('prompts')
  async updatePrompt(
    @Query('storeId') storeId: string,
    @Body() body: AgentPromptDto,
    @Req() req: AdminRequest,
  ) {
    return this.agent.updateConfig(await this.storeId(req, storeId), { systemPrompt: body.prompt })
  }

  @Public()
  @Post('telegram/webhook')
  async telegramWebhook(
    @Query('storeId') storeId: string,
    @Headers('x-telegram-bot-api-secret-token') secret?: string,
  ) {
    const expected = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET')?.trim()
    if (!expected) {
      throw new UnauthorizedException('Telegram webhook secret is not configured')
    }
    if (secret !== expected) {
      throw new UnauthorizedException('Invalid webhook secret')
    }
    throw new GoneException(
      'Use POST /api/v1/telegram-webhook instead — agent/telegram/webhook is deprecated.',
    )
  }
}
