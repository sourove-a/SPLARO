import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import { SecurityService } from './security.service'

@Controller('admin/security')
export class SecurityController {
  constructor(
    private readonly security: SecurityService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  overview(@Query('storeId') storeId: string) {
    return this.security.overview(storeId)
  }

  // ── Audit Logs ─────────────────────────────────────────────

  @Get('audit-logs')
  async auditLogs(
    @Query('storeId') storeId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const where = {
      storeId: sid,
      ...(action ? { action: { contains: action, mode: 'insensitive' as const } } : {}),
      ...(userId ? { userId } : {}),
    }
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      this.prisma.auditLog.count({ where }),
    ])
    return { logs, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) }
  }

  // ── Sessions ───────────────────────────────────────────────

  @Get('sessions')
  async sessions(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.prisma.deviceSession.findMany({
      where: {
        isRevoked: false,
        expiresAt: { gt: new Date() },
        user: { staffRoles: { some: { storeId: sid } } },
      },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { lastActive: 'desc' },
    })
  }

  @Delete('sessions/:id')
  async revokeSession(@Param('id') id: string) {
    await this.prisma.deviceSession.update({ where: { id }, data: { isRevoked: true } })
    return { revoked: true }
  }

  @Post('sessions/revoke-all')
  async revokeAllSessions(@Query('storeId') storeId: string, @Body('userId') userId?: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const where = userId
      ? { userId }
      : { user: { staffRoles: { some: { storeId: sid } } } }
    const { count } = await this.prisma.deviceSession.updateMany({ where, data: { isRevoked: true } })
    return { revoked: count }
  }

  // ── IP Rules ───────────────────────────────────────────────

  @Get('ip-rules')
  listIpRules() {
    return this.prisma.ipRule.findMany({ orderBy: { createdAt: 'desc' } })
  }

  @Post('ip-rules')
  createIpRule(@Body() body: { ip: string; type: 'ALLOW' | 'BLOCK'; note?: string; expiresAt?: string }) {
    return this.prisma.ipRule.create({
      data: {
        ip: body.ip,
        type: body.type,
        note: body.note,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    })
  }

  @Delete('ip-rules/:id')
  deleteIpRule(@Param('id') id: string) {
    return this.prisma.ipRule.delete({ where: { id } })
  }

  // ── Staff / Roles ──────────────────────────────────────────

  @Get('staff')
  async staff(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.prisma.staffRole.findMany({
      where: { storeId: sid },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true, lastLoginAt: true, twoFAEnabled: true } },
      },
    })
  }

  @Post('staff')
  async addStaff(
    @Query('storeId') storeId: string,
    @Body() body: { userId: string; role: string; permissions?: string[] },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.prisma.staffRole.upsert({
      where: { userId_storeId: { userId: body.userId, storeId: sid } },
      create: { userId: body.userId, storeId: sid, role: body.role as never, permissions: body.permissions ?? [] },
      update: { role: body.role as never, permissions: body.permissions ?? [] },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    })
  }

  @Patch('staff/:userId')
  async updateStaff(
    @Query('storeId') storeId: string,
    @Param('userId') userId: string,
    @Body() body: { role?: string; permissions?: string[]; isActive?: boolean },
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const updates: Promise<unknown>[] = []

    if (body.role !== undefined || body.permissions !== undefined) {
      updates.push(
        this.prisma.staffRole.update({
          where: { userId_storeId: { userId, storeId: sid } },
          data: {
            ...(body.role !== undefined ? { role: body.role as never } : {}),
            ...(body.permissions !== undefined ? { permissions: body.permissions } : {}),
          },
        }),
      )
    }

    if (body.isActive !== undefined) {
      updates.push(this.prisma.user.update({ where: { id: userId }, data: { isActive: body.isActive } }))
    }

    await Promise.all(updates)
    return { updated: true }
  }

  @Delete('staff/:userId')
  async removeStaff(@Query('storeId') storeId: string, @Param('userId') userId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    await this.prisma.staffRole.delete({ where: { userId_storeId: { userId, storeId: sid } } })
    return { removed: true }
  }

  // ── Login history ──────────────────────────────────────────

  @Get('login-history')
  async loginHistory(
    @Query('storeId') storeId: string,
    @Query('userId') userId?: string,
    @Query('success') success?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const take = Math.min(Number(limit) || 50, 200)
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take

    const where = {
      user: { staffRoles: { some: { storeId: sid } } },
      ...(userId ? { userId } : {}),
      ...(success !== undefined ? { success: success === 'true' } : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.loginHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.loginHistory.count({ where }),
    ])

    return { items, total, page: Number(page) || 1, limit: take }
  }

  @Get('login-history/stats')
  async loginStats(@Query('storeId') storeId: string, @Query('days') days?: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const since = new Date()
    since.setDate(since.getDate() - (Number(days) || 14))

    const [total, failed, byDevice] = await Promise.all([
      this.prisma.loginHistory.count({
        where: { user: { staffRoles: { some: { storeId: sid } } }, createdAt: { gte: since } },
      }),
      this.prisma.loginHistory.count({
        where: {
          user: { staffRoles: { some: { storeId: sid } } },
          createdAt: { gte: since },
          success: false,
        },
      }),
      this.prisma.loginHistory.groupBy({
        by: ['device'],
        where: { user: { staffRoles: { some: { storeId: sid } } }, createdAt: { gte: since } },
        _count: true,
      }),
    ])

    return {
      period: `${Number(days) || 14}d`,
      totalLogins: total,
      failedLogins: failed,
      successRate: total > 0 ? Math.round(((total - failed) / total) * 100) : 100,
      byDevice,
    }
  }

  // ── Fraud & COD risk ───────────────────────────────────────

  @Get('fraud/alerts')
  async fraudAlerts(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const [highRiskOrders, highRiskCustomers, recentFlaggedOrders] = await Promise.all([
      this.prisma.order.count({ where: { storeId: sid, isCodRisk: true, status: 'PENDING' } }),
      this.prisma.customer.count({ where: { storeId: sid, codRiskScore: { gte: 70 } } }),
      this.prisma.order.findMany({
        where: { storeId: sid, fraudScore: { gte: 60 } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          invoiceNumber: true,
          shippingName: true,
          shippingPhone: true,
          total: true,
          fraudScore: true,
          fraudFlags: true,
          isCodRisk: true,
          status: true,
          createdAt: true,
        },
      }),
    ])

    return {
      summary: { highRiskOrders, highRiskCustomers },
      recentFlaggedOrders,
    }
  }

  @Patch('fraud/orders/:orderId')
  async updateFraudFlags(
    @Param('orderId') orderId: string,
    @Body()
    body: {
      fraudScore?: number
      fraudFlags?: string[]
      isCodRisk?: boolean
      requireAdvancePayment?: boolean
    },
  ) {
    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        ...(body.fraudScore !== undefined ? { fraudScore: body.fraudScore } : {}),
        ...(body.fraudFlags !== undefined ? { fraudFlags: body.fraudFlags } : {}),
        ...(body.isCodRisk !== undefined ? { isCodRisk: body.isCodRisk } : {}),
        ...(body.requireAdvancePayment !== undefined ? { requireAdvancePayment: body.requireAdvancePayment } : {}),
      },
      select: { id: true, invoiceNumber: true, fraudScore: true, fraudFlags: true, isCodRisk: true },
    })
  }

  // ── 2FA ────────────────────────────────────────────────────

  @Get('2fa/status')
  async twoFaStatus(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const staff = await this.prisma.staffRole.findMany({
      where: { storeId: sid },
      include: { user: { select: { id: true, firstName: true, twoFAEnabled: true } } },
    })
    const enabled = staff.filter((s) => s.user.twoFAEnabled).length
    return {
      total: staff.length,
      enabled,
      disabled: staff.length - enabled,
      coverage: staff.length > 0 ? Math.round((enabled / staff.length) * 100) : 0,
      staff: staff.map((s) => ({ userId: s.userId, name: s.user.firstName, twoFAEnabled: s.user.twoFAEnabled })),
    }
  }
}
