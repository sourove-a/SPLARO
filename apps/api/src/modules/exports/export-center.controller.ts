import { BadRequestException, Body, Controller, Get, Post, Query, Req } from '@nestjs/common'
import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import type { AdminSessionPayload } from '../../common/auth/admin-session.util'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'

type AdminRequest = Request & { adminUser?: AdminSessionPayload }

const EXPORT_KINDS = new Set(['orders', 'customers', 'products'] as const)
const EXPORT_FORMATS = new Set(['csv', 'xlsx'] as const)
const MODULE = 'export-center'

type ExportKind = 'orders' | 'customers' | 'products'
type ExportFormat = 'csv' | 'xlsx'

function isKind(value: unknown): value is ExportKind {
  return typeof value === 'string' && EXPORT_KINDS.has(value as ExportKind)
}

function isFormat(value: unknown): value is ExportFormat {
  return typeof value === 'string' && EXPORT_FORMATS.has(value as ExportFormat)
}

function actorLabel(admin?: AdminSessionPayload): string {
  const name = admin?.name?.trim()
  if (name) return name
  return admin?.email?.trim() || 'Unknown'
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

@Controller('admin/exports')
export class ExportCenterController {
  constructor(private readonly prisma: PrismaService) {}

  /** Session ids like admin_env_user may not exist on User — skip FK. */
  private async resolveUserId(userId?: string): Promise<string | null> {
    if (!userId) return null
    const row = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    return row?.id ?? null
  }

  @Get('history')
  async history(@Query('storeId') storeId: string, @Query('limit') limit?: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const take = Math.min(Math.max(Number(limit) || 30, 1), 100)
    const logs = await this.prisma.auditLog.findMany({
      where: { storeId: sid, module: MODULE },
      orderBy: { createdAt: 'desc' },
      take,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    })
    return {
      items: logs.map((row) => {
        const data = asRecord(row.newData)
        const userName = [row.user?.firstName, row.user?.lastName].filter(Boolean).join(' ').trim()
        const triggeredBy =
          (typeof data.triggeredBy === 'string' && data.triggeredBy.trim()) ||
          userName ||
          row.user?.email ||
          'Unknown'
        return {
          id: row.id,
          createdAt: row.createdAt.toISOString(),
          kind: row.resource,
          format: typeof data.format === 'string' ? data.format : null,
          rowCount: typeof data.rowCount === 'number' ? data.rowCount : Number(data.rowCount) || 0,
          from: typeof data.from === 'string' ? data.from : null,
          to: typeof data.to === 'string' ? data.to : null,
          triggeredBy,
        }
      }),
    }
  }

  @Post('log')
  async log(
    @Query('storeId') storeId: string,
    @Body()
    body: {
      kind?: string
      format?: string
      rowCount?: number
      from?: string
      to?: string
    },
    @Req() req: AdminRequest,
  ) {
    if (!isKind(body?.kind)) throw new BadRequestException('kind must be orders, customers, or products')
    if (!isFormat(body?.format)) throw new BadRequestException('format must be csv or xlsx')
    const rowCount = Number(body.rowCount)
    if (!Number.isFinite(rowCount) || rowCount < 0) {
      throw new BadRequestException('rowCount must be a non-negative number')
    }

    const sid = await resolveStoreId(this.prisma, storeId)
    const userId = await this.resolveUserId(req.adminUser?.userId)
    const triggeredBy = actorLabel(req.adminUser)
    const newData: Prisma.InputJsonValue = {
      format: body.format,
      rowCount,
      triggeredBy,
      ...(body.from?.trim() ? { from: body.from.trim() } : {}),
      ...(body.to?.trim() ? { to: body.to.trim() } : {}),
    }

    const created = await this.prisma.auditLog.create({
      data: {
        storeId: sid,
        userId,
        action: 'EXPORT',
        module: MODULE,
        resource: body.kind,
        newData,
        source: 'WEB',
      },
    })
    return { ok: true as const, id: created.id }
  }
}
