import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Req } from '@nestjs/common'
import type { Request } from 'express'
import { RequireFeature } from '../../common/auth/require-feature.decorator'
import { canWriteAdmin } from '../../common/auth/admin-session.util'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import { MANUS_AGENT_PROFILES, ManusService, type ManusAgentProfile } from './manus.service'

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

@RequireFeature('ai')
@Controller('manus')
export class ManusController {
  constructor(private readonly manus: ManusService) {}

  private assertWritable(req: AdminRequest) {
    const role = req.adminUser?.role
    if (!role || !canWriteAdmin(role)) {
      throw new ForbiddenException('Insufficient permissions to start or stop Manus tasks')
    }
  }

  @Get('status')
  async status() {
    return { configured: await this.manus.isConfigured(), agentProfiles: MANUS_AGENT_PROFILES }
  }

  @Get('tasks')
  listTasks(@Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    return this.manus.listTasks(Number(limit) || 20, cursor)
  }

  @Get('tasks/:taskId/messages')
  listMessages(@Param('taskId') taskId: string, @Query('limit') limit?: string) {
    return this.manus.listMessages(taskId, Number(limit) || 50)
  }

  @Post('tasks')
  createTask(
    @Req() req: AdminRequest,
    @Body() body: { prompt: string; agentProfile?: string; locale?: string; title?: string },
  ) {
    this.assertWritable(req)
    const profile = MANUS_AGENT_PROFILES.includes(body.agentProfile as ManusAgentProfile)
      ? (body.agentProfile as ManusAgentProfile)
      : undefined
    return this.manus.createTask({
      prompt: body.prompt,
      ...(profile ? { agentProfile: profile } : {}),
      ...(body.locale ? { locale: body.locale } : {}),
      ...(body.title ? { title: body.title } : {}),
    })
  }

  @Post('tasks/:taskId/stop')
  stopTask(@Req() req: AdminRequest, @Param('taskId') taskId: string) {
    this.assertWritable(req)
    return this.manus.stopTask(taskId)
  }
}
