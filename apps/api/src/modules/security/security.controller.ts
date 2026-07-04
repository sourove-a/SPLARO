import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common'
import type { Request } from 'express'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import { DatabaseConnectionService, type DatabaseCredentialsInput } from './database-connection.service'
import { SecurityService } from './security.service'

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

@Controller('admin/security')
export class SecurityController {
  constructor(
    private readonly security: SecurityService,
    private readonly databaseConnection: DatabaseConnectionService,
  ) {}

  @Get('database')
  databaseInfo(@Req() req: AdminRequest) {
    return this.databaseConnection.info(req.adminUser)
  }

  @Post('database/test')
  databaseTest(@Body() body: DatabaseCredentialsInput, @Req() req: AdminRequest) {
    return this.databaseConnection.test(body, req.adminUser)
  }

  @Post('database')
  databaseSave(@Body() body: DatabaseCredentialsInput, @Req() req: AdminRequest) {
    return this.databaseConnection.save(body, req.adminUser)
  }

  @Get()
  overview(@Query('storeId') storeId: string, @Req() req: AdminRequest) {
    return this.security.overview(storeId, req.adminUser)
  }

  @Get('audit-logs')
  auditLogs(
    @Req() req: AdminRequest,
    @Query('storeId') storeId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
  ) {
    return this.security.listAuditLogs(storeId, req.adminUser, { page: Number(page), limit: Number(limit), action, userId })
  }

  @Get('permissions')
  getPermissions(@Query('storeId') storeId: string, @Req() req: AdminRequest) {
    return this.security.getPermissions(storeId, req.adminUser)
  }

  @Put('permissions/:role')
  saveRolePermissions(
    @Query('storeId') storeId: string,
    @Param('role') role: string,
    @Body() body: { permissions: { module: string; view: boolean; create: boolean; edit: boolean; delete: boolean }[] },
    @Req() req: AdminRequest,
  ) {
    return this.security.saveRolePermissions(storeId, role, body.permissions, req.adminUser, req)
  }

  @Get('sessions')
  sessions(@Query('storeId') storeId: string, @Req() req: AdminRequest) {
    return this.security.listSessions(storeId, req.adminUser)
  }

  @Delete('sessions/:id')
  revokeSession(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.security.revokeSession(id, req.adminUser, req)
  }

  @Post('sessions/revoke-all')
  revokeAllSessions(
    @Query('storeId') storeId: string,
    @Body('userId') userId: string | undefined,
    @Req() req: AdminRequest,
  ) {
    return this.security.revokeAllSessions(storeId, userId, req.adminUser, req)
  }

  @Get('ip-rules')
  listIpRules(@Req() req: AdminRequest) {
    return this.security.listIpRules(req.adminUser)
  }

  @Post('ip-rules')
  createIpRule(
    @Body() body: { ip: string; type: 'ALLOW' | 'BLOCK'; note?: string; expiresAt?: string },
    @Req() req: AdminRequest,
  ) {
    return this.security.createIpRule(body, req.adminUser, req)
  }

  @Delete('ip-rules/:id')
  deleteIpRule(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.security.deleteIpRule(id, req.adminUser, req)
  }

  @Get('staff')
  staff(@Query('storeId') storeId: string, @Req() req: AdminRequest) {
    return this.security.listStaff(storeId, req.adminUser)
  }

  @Post('staff/invite')
  inviteStaff(
    @Query('storeId') storeId: string,
    @Body() body: { email: string; firstName: string; lastName?: string; role: string; password: string },
    @Req() req: AdminRequest,
  ) {
    return this.security.inviteStaff(storeId, body, req.adminUser, req)
  }

  @Post('staff')
  addStaff(
    @Query('storeId') storeId: string,
    @Body() body: { userId: string; role: string; permissions?: string[] },
    @Req() req: AdminRequest,
  ) {
    return this.security.assignStaff(storeId, body, req.adminUser, req)
  }

  @Patch('staff/:userId')
  updateStaff(
    @Query('storeId') storeId: string,
    @Param('userId') userId: string,
    @Body() body: { role?: string; permissions?: string[]; isActive?: boolean },
    @Req() req: AdminRequest,
  ) {
    return this.security.updateStaff(storeId, userId, body, req.adminUser, req)
  }

  @Delete('staff/:userId')
  removeStaff(
    @Query('storeId') storeId: string,
    @Param('userId') userId: string,
    @Req() req: AdminRequest,
  ) {
    return this.security.removeStaff(storeId, userId, req.adminUser, req)
  }

  @Get('login-history')
  loginHistory(
    @Req() req: AdminRequest,
    @Query('storeId') storeId: string,
    @Query('userId') userId?: string,
    @Query('success') success?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.security.loginHistory(storeId, req.adminUser, { userId, success, page, limit })
  }

  @Get('login-history/stats')
  loginStats(@Req() req: AdminRequest, @Query('storeId') storeId: string, @Query('days') days?: string) {
    return this.security.loginStats(storeId, req.adminUser, days)
  }

  @Get('fraud/alerts')
  fraudAlerts(@Query('storeId') storeId: string, @Req() req: AdminRequest) {
    return this.security.fraudAlerts(storeId, req.adminUser)
  }

  @Patch('fraud/orders/:orderId')
  updateFraudFlags(
    @Query('storeId') storeId: string,
    @Param('orderId') orderId: string,
    @Body()
    body: {
      fraudScore?: number
      fraudFlags?: string[]
      isCodRisk?: boolean
      requireAdvancePayment?: boolean
    },
    @Req() req: AdminRequest,
  ) {
    return this.security.updateFraudFlags(storeId, orderId, body, req.adminUser, req)
  }

  @Get('2fa/status')
  twoFaStatus(@Query('storeId') storeId: string, @Req() req: AdminRequest) {
    return this.security.twoFaStatus(storeId, req.adminUser)
  }
}
