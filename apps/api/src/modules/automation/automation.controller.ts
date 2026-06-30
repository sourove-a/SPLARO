import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Inject } from '@nestjs/common'
import { AutomationService } from './automation.service'
import { PrismaService } from '../../common/prisma.service'
import { resolveStoreId } from '../../common/store.util'
import type { AutomationTrigger } from '@prisma/client'

@Controller('automation')
export class AutomationController {
  constructor(
    @Inject(AutomationService) private readonly automationService: AutomationService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Get('rules')
  async getRules(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.automationService.getRulesForStore(sid)
  }

  @Get('rules/:id')
  async getRule(@Param('id') id: string) {
    return this.prisma.automationRule.findUnique({
      where: { id },
      include: { conditions: true, actions: true, logs: { orderBy: { createdAt: 'desc' }, take: 20 } },
    })
  }

  @Post('rules')
  async createRule(@Body() body: Parameters<AutomationService['createRule']>[1] & { storeId: string }) {
    const { storeId, ...data } = body
    const sid = await resolveStoreId(this.prisma, storeId)
    return this.automationService.createRule(sid, data)
  }

  @Patch('rules/:id')
  async updateRule(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; isActive?: boolean },
  ) {
    return this.prisma.automationRule.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
      include: { conditions: true, actions: true },
    })
  }

  @Patch('rules/:id/toggle')
  toggleRule(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.automationService.toggleRule(id, isActive)
  }

  @Delete('rules/:id')
  async deleteRule(@Param('id') id: string) {
    await this.prisma.automationRule.delete({ where: { id } })
    return { deleted: id }
  }

  @Post('trigger')
  runTrigger(@Body() body: { storeId: string; trigger: AutomationTrigger; context: Record<string, unknown> }) {
    return this.automationService.runTrigger(body.storeId, body.trigger, body.context)
  }

  /** Automation run logs across all rules for a store */
  @Get('logs')
  async logs(
    @Query('storeId') storeId: string,
    @Query('ruleId') ruleId?: string,
    @Query('success') success?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const take = Math.min(Number(limit) || 30, 100)
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take

    const where = {
      rule: { storeId: sid },
      ...(ruleId ? { ruleId } : {}),
      ...(success !== undefined ? { success: success === 'true' } : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.automationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { rule: { select: { name: true, trigger: true } } },
      }),
      this.prisma.automationLog.count({ where }),
    ])

    return { items, total, page: Number(page) || 1, limit: take }
  }

  /** Stats: rule run counts, success rate */
  @Get('stats')
  async stats(@Query('storeId') storeId: string) {
    const sid = await resolveStoreId(this.prisma, storeId)
    const rules = await this.prisma.automationRule.findMany({
      where: { storeId: sid },
      select: {
        id: true,
        name: true,
        trigger: true,
        isActive: true,
        runCount: true,
        lastRunAt: true,
        _count: { select: { logs: true } },
      },
      orderBy: { runCount: 'desc' },
    })

    const [successCount, failCount] = await Promise.all([
      this.prisma.automationLog.count({ where: { rule: { storeId: sid }, success: true } }),
      this.prisma.automationLog.count({ where: { rule: { storeId: sid }, success: false } }),
    ])

    return {
      rules,
      totalRuns: successCount + failCount,
      successCount,
      failCount,
      successRate: successCount + failCount > 0
        ? Math.round((successCount / (successCount + failCount)) * 100)
        : 100,
    }
  }
}
