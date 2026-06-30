import { Injectable, Logger, Optional } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { SmsService } from '../notifications/sms.service'
import { WebhooksService } from '../webhooks/webhooks.service'
import type { AutomationTrigger, AutomationRule, AutomationCondition, AutomationRuleAction, Prisma } from '@prisma/client'

type RuleWithRelations = AutomationRule & {
  conditions: AutomationCondition[]
  actions: AutomationRuleAction[]
}

/**
 * Automation Rules Engine
 * Evaluates trigger-condition-action chains from admin-configured rules
 */
@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications: NotificationsService,
    @Optional() private readonly sms: SmsService,
    @Optional() private readonly webhooks: WebhooksService,
  ) {}

  /**
   * Main entry point — call this when a trigger event fires
   */
  async runTrigger(
    storeId: string,
    trigger: AutomationTrigger,
    context: Record<string, unknown>,
  ): Promise<void> {
    const rules = await this.prisma.automationRule.findMany({
      where: { storeId, trigger, isActive: true },
      include: { conditions: true, actions: { orderBy: { sortOrder: 'asc' } } },
    })

    for (const rule of rules) {
      await this.evaluateRule(rule, context)
    }
  }

  private async evaluateRule(rule: RuleWithRelations, context: Record<string, unknown>): Promise<void> {
    const allPass = rule.conditions.every((cond) => this.evaluateCondition(cond, context))

    const logBase = { ruleId: rule.id, context, triggeredBy: String(context['triggeredBy'] ?? 'system') }

    if (!allPass) {
      this.logger.debug(`Rule "${rule.name}" conditions not met — skipping`)
      return
    }

    this.logger.log(`Rule "${rule.name}" triggered — executing ${rule.actions.length} actions`)

    let success = true
    let errorMsg: string | undefined

    try {
      for (const action of rule.actions) {
        await this.executeAction(action, context, rule.id)
      }

      await this.prisma.automationRule.update({
        where: { id: rule.id },
        data: { runCount: { increment: 1 }, lastRunAt: new Date() },
      })
    } catch (err) {
      success = false
      errorMsg = err instanceof Error ? err.message : 'Unknown error'
      this.logger.error(`Rule "${rule.name}" action failed: ${errorMsg}`)
    }

    await this.prisma.automationLog.create({
      data: { ...logBase, context: context as Prisma.InputJsonObject, success, errorMsg },
    })
  }

  private evaluateCondition(condition: AutomationCondition, context: Record<string, unknown>): boolean {
    const fieldValue = this.getNestedValue(context, condition.field)
    const condValue = condition.value

    switch (condition.operator) {
      case 'EQUALS': return String(fieldValue) === condValue
      case 'NOT_EQUALS': return String(fieldValue) !== condValue
      case 'GREATER_THAN': return Number(fieldValue) > Number(condValue)
      case 'LESS_THAN': return Number(fieldValue) < Number(condValue)
      case 'CONTAINS': return String(fieldValue).toLowerCase().includes(condValue.toLowerCase())
      case 'NOT_CONTAINS': return !String(fieldValue).toLowerCase().includes(condValue.toLowerCase())
      case 'IN': return condValue.split(',').map(s => s.trim()).includes(String(fieldValue))
      case 'NOT_IN': return !condValue.split(',').map(s => s.trim()).includes(String(fieldValue))
      default: return false
    }
  }

  private async executeAction(
    action: AutomationRuleAction,
    context: Record<string, unknown>,
    ruleId: string,
  ): Promise<void> {
    const params = action.params as Record<string, unknown>

    switch (action.action) {
      case 'SEND_TELEGRAM': {
        const storeId = String(context['storeId'] ?? '')
        const message = String(params['message'] ?? 'SPLARO automation notification')
        if (storeId) {
          await this.notifications?.notifyAdmin({ subject: 'Automation', body: message, storeId, level: 'info' })
        }
        break
      }

      case 'BOOK_COURIER': {
        const orderId = String(context['orderId'] ?? '')
        this.logger.log(`[Rule ${ruleId}] BOOK_COURIER for order ${orderId}`)
        // Actual booking dispatched via CourierService — call from OrdersService hook
        break
      }

      case 'APPLY_COUPON': {
        const orderId = String(context['orderId'] ?? '')
        const couponCode = String(params['couponCode'] ?? '')
        if (orderId && couponCode) {
          this.logger.log(`[Rule ${ruleId}] APPLY_COUPON ${couponCode} to order ${orderId}`)
        }
        break
      }

      case 'SEND_EMAIL': {
        const email = String(context['email'] ?? params['email'] ?? '')
        const subject = String(params['subject'] ?? 'SPLARO Notification')
        const body = String(params['body'] ?? '')
        this.logger.log(`[Rule ${ruleId}] SEND_EMAIL to ${email}: ${subject}`)
        // Wire to EmailService when configured
        break
      }

      case 'SEND_SMS': {
        const phone = String(context['phone'] ?? params['phone'] ?? '')
        const message = String(params['message'] ?? 'SPLARO notification')
        const storeId = String(context['storeId'] ?? '')
        if (phone && this.sms) {
          const result = await this.sms.send(phone, message, storeId || undefined)
          if (!result.sent) this.logger.warn(`[Rule ${ruleId}] SMS failed: ${result.error}`)
        }
        break
      }

      case 'SEND_WHATSAPP': {
        const phone = String(context['phone'] ?? params['phone'] ?? '')
        const message = String(params['message'] ?? 'SPLARO notification')
        this.logger.log(`[Rule ${ruleId}] SEND_WHATSAPP to ${phone}: ${message}`)
        break
      }

      case 'APPLY_TAG': {
        const customerId = String(context['customerId'] ?? '')
        const tag = String(params['tag'] ?? '')
        if (customerId && tag) {
          const customer = await this.prisma.customer.findUnique({ where: { id: customerId } })
          if (customer && !customer.tags.includes(tag)) {
            await this.prisma.customer.update({
              where: { id: customerId },
              data: { tags: { push: tag } },
            })
          }
        }
        break
      }

      case 'REMOVE_TAG': {
        const customerId = String(context['customerId'] ?? '')
        const tag = String(params['tag'] ?? '')
        if (customerId && tag) {
          const customer = await this.prisma.customer.findUnique({ where: { id: customerId } })
          if (customer) {
            await this.prisma.customer.update({
              where: { id: customerId },
              data: { tags: customer.tags.filter((t) => t !== tag) },
            })
          }
        }
        break
      }

      case 'REQUIRE_ADVANCE_PAYMENT': {
        const orderId = String(context['orderId'] ?? '')
        if (orderId) {
          await this.prisma.order.update({
            where: { id: orderId },
            data: { requireAdvancePayment: true, isCodRisk: true },
          })
        }
        break
      }

      case 'HIDE_PRODUCT': {
        const productId = String(context['productId'] ?? '')
        if (productId) {
          await this.prisma.product.update({
            where: { id: productId },
            data: { isHidden: true, isPublished: false },
          })
        }
        break
      }

      case 'NOTIFY_ADMIN': {
        const subject = String(params['subject'] ?? 'Automation Rule Triggered')
        const body = String(params['message'] ?? 'Automation triggered')
        const storeId = String(context['storeId'] ?? '')
        await this.notifications?.notifyAdmin({ subject, body, storeId, level: 'info' })
        break
      }

      case 'UPDATE_ORDER_STATUS': {
        const orderId = String(context['orderId'] ?? '')
        const newStatus = String(params['status'] ?? '')
        if (orderId && newStatus) {
          await this.prisma.order.update({
            where: { id: orderId },
            data: { status: newStatus as never },
          })
        }
        break
      }

      case 'ADD_LOYALTY_POINTS': {
        const customerId = String(context['customerId'] ?? '')
        const points = Number(params['points'] ?? 0)
        if (customerId && points > 0) {
          await this.prisma.$transaction([
            this.prisma.customer.update({
              where: { id: customerId },
              data: { loyaltyPoints: { increment: points } },
            }),
            this.prisma.loyaltyHistory.create({
              data: {
                customerId,
                points,
                type: 'EARN',
                reason: `Automation: Rule ${ruleId}`,
                orderId: String(context['orderId'] ?? ''),
              },
            }),
          ])
        }
        break
      }

      case 'CUSTOM_WEBHOOK': {
        const webhookUrl = String(params['url'] ?? '')
        if (webhookUrl) {
          try {
            await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ruleId, context }),
              signal: AbortSignal.timeout(5000),
            })
          } catch (err) {
            this.logger.error(`Webhook call failed: ${err instanceof Error ? err.message : 'error'}`)
          }
        }
        break
      }


      default:
        this.logger.warn(`Unknown action type: ${String(action.action)}`)
    }
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key]
      }
      return undefined
    }, obj)
  }

  // ── RULE CRUD ──────────────────────────────────────────────

  async createRule(storeId: string, data: {
    name: string
    description?: string
    trigger: AutomationTrigger
    conditions: { field: string; operator: string; value: string }[]
    actions: { action: string; params: Record<string, unknown>; sortOrder: number }[]
  }) {
    return this.prisma.automationRule.create({
      data: {
        storeId,
        name: data.name,
        description: data.description,
        trigger: data.trigger,
        conditions: {
          create: data.conditions.map(c => ({
            field: c.field,
            operator: c.operator as never,
            value: c.value,
          })),
        },
        actions: {
          create: data.actions.map(a => ({
            action: a.action as never,
            params: a.params as Prisma.InputJsonObject,
            sortOrder: a.sortOrder,
          })),
        },
      },
      include: { conditions: true, actions: true },
    })
  }

  async toggleRule(ruleId: string, isActive: boolean) {
    return this.prisma.automationRule.update({
      where: { id: ruleId },
      data: { isActive },
    })
  }

  async getRulesForStore(storeId: string) {
    return this.prisma.automationRule.findMany({
      where: { storeId },
      include: {
        conditions: true,
        actions: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { logs: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }
}
