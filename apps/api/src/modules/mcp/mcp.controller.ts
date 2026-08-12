import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common'
import type { Request } from 'express'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import { McpTokenService } from './mcp-token.service'

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

@Controller('admin/mcp')
export class McpController {
  constructor(private readonly mcpTokens: McpTokenService) {}

  @Get('tokens')
  list(@Query('storeId') storeId: string, @Req() req: AdminRequest) {
    return this.mcpTokens.list(storeId || req.adminUser?.storeId || 'splaro', req.adminUser)
  }

  @Post('tokens')
  create(
    @Query('storeId') storeId: string,
    @Body() body: { name?: string; scopes?: string[] },
    @Req() req: AdminRequest,
  ) {
    return this.mcpTokens.create(storeId || req.adminUser?.storeId || 'splaro', body ?? {}, req.adminUser)
  }

  @Delete('tokens/:id')
  revoke(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.mcpTokens.revoke(id, req.adminUser)
  }
}
