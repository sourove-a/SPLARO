import { Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { isOrderStatus } from '../../common/order-status.util'
import { NotificationsService } from '../notifications/notifications.service'
import { SmsService } from '../notifications/sms.service'
import { WebhooksService } from '../webhooks/webhooks.service'
import { OrderStatusService } from '../orders/order-status.service'
import { EmailService } from '../email/email.service'
import { CourierService } from '../courier/courier.service'
import { isSchedulerInstance } from '../../common/scheduler-instance.util'
import type { AutomationTrigger, AutomationRule, AutomationCondition, AutomationRuleAction, CourierProvider, Prisma } from '@prisma/client'

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
    @Inject(forwardRef(() => OrderStatusService))
    private readonly orderStatus: OrderStatusService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly sms?: SmsService,
    @Optional() private readonly webhooks?: WebhooksService,
    @Optional() private readonly email?: EmailService,
    @Optional()
    @Inject(forwardRef(() => CourierService))
    private readonly courier?: CourierService,
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
      case 'EQUALS': return String(fieldValue ?? '') === condValue
      case 'NOT_EQUALS': return String(fieldValue ?? '') !== condValue
      case 'GREATER_THAN': return Number(fieldValue) > Number(condValue)
      case 'LESS_THAN': return Number(fieldValue) < Number(condValue)
      case 'CONTAINS': return String(fieldValue ?? '').toLowerCase().includes(condValue.toLowerCase())
      case 'NOT_CONTAINS': return !String(fieldValue ?? '').toLowerCase().includes(condValue.toLowerCase())
      case 'IN': return condValue.split(',').map(s => s.trim()).includes(String(fieldValue ?? ''))
      case 'NOT_IN': return !condValue.split(',').map(s => s.trim()).includes(String(fieldValue ?? ''))
      default: return false
    }
  }

  private interpolateTemplate(text: string, context: Record<string, unknown>): string {
    return text.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key: string) => {
      const val = this.getNestedValue(context, key)
      return val !== undefined && val !== null ? String(val) : ''
    })
  }

  private async executeAction(
    action: AutomationRuleAction,
    context: Record<string, unknown>,
    ruleId: string,
  ): Promise<void> {
    const params = (action.params ?? {}) as Record<string, unknown>
    const storeId = String(context['storeId'] ?? '')

    switch (action.action) {
      case 'SEND_TELEGRAM': {
        const rawMessage = String(params['message'] ?? params['body'] ?? 'SPLARO automation notification')
        const message = this.interpolateTemplate(rawMessage, context)
        if (storeId) {
          await this.notifications?.notifyAdmin({ subject: 'Automation', body: message, storeId, level: 'info' })
        }
        break
      }

      case 'BOOK_COURIER': {
        const orderId = String(context['orderId'] ?? context['id'] ?? '').trim()
        if (!orderId) {
          this.logger.warn(`[Rule ${ruleId}] BOOK_COURIER skipped — missing orderId in context`)
          throw new Error('Missing orderId in automation context')
        }

        if (!this.courier) {
          this.logger.warn(`[Rule ${ruleId}] BOOK_COURIER failed — CourierService not configured`)
          throw new Error('Courier service is not configured')
        }

        // Idempotency: verify existing active shipment before attempting dispatch
        const existing = await this.prisma.courierShipment.findUnique({
          where: { orderId },
          select: { consignmentId: true, status: true, trackingCode: true },
        })
        if (existing?.consignmentId && existing.status !== 'CANCELLED') {
          this.logger.log(`[Rule ${ruleId}] BOOK_COURIER order ${orderId} already booked (consignment: ${existing.consignmentId})`)
          break
        }

        const requestedProvider = params['provider']
          ? (String(params['provider']).toUpperCase() as CourierProvider)
          : undefined

        const result = await this.courier.bookCourier(orderId, requestedProvider, { storeId })
        if (result.alreadyBooked) {
          this.logger.log(`[Rule ${ruleId}] BOOK_COURIER order ${orderId} already booked (${result.consignmentId ?? 'existing'})`)
          break
        }
        if (!result.success) {
          const err = result.error || (result.simulated ? 'Simulated booking (not sent to live courier)' : 'Courier booking failed')
          this.logger.warn(`[Rule ${ruleId}] BOOK_COURIER for order ${orderId} failed: ${err}`)
          throw new Error(`Courier booking failed: ${err}`)
        }

        this.logger.log(`[Rule ${ruleId}] BOOK_COURIER order ${orderId} successfully booked (${result.consignmentId ?? 'OK'})`)
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
        const targetEmail = String(context['email'] ?? context['customerEmail'] ?? params['email'] ?? '').trim()
        if (!targetEmail || !targetEmail.includes('@')) {
          this.logger.warn(`[Rule ${ruleId}] SEND_EMAIL failed — missing or invalid email: "${targetEmail}"`)
          throw new Error(`Invalid or missing email address: "${targetEmail}"`)
        }

        if (!storeId) {
          this.logger.warn(`[Rule ${ruleId}] SEND_EMAIL failed — missing storeId`)
          throw new Error('Missing storeId in automation context')
        }

        if (!this.email) {
          this.logger.warn(`[Rule ${ruleId}] SEND_EMAIL failed — EmailService not available`)
          throw new Error('Email service is not available')
        }

        const rawSubject = String(params['subject'] ?? 'SPLARO Notification')
        const rawBody = String(params['body'] ?? params['message'] ?? '')
        const subject = this.interpolateTemplate(rawSubject, context)
        const bodyText = this.interpolateTemplate(rawBody, context)
        const html = params['html']
          ? this.interpolateTemplate(String(params['html']), context)
          : `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #111827; padding: 20px; max-width: 600px;">
              <h2 style="font-size: 18px; font-weight: 600; margin-top: 0; color: #000;">${subject}</h2>
              <div style="white-space: pre-wrap;">${bodyText}</div>
              <hr style="margin: 24px 0 16px; border: 0; border-top: 1px solid #E5E7EB;" />
              <p style="font-size: 11px; color: #6B7280; margin: 0;">Automated notification from SPLARO.</p>
            </div>`

        const sent = await this.email.sendForStore({
          storeId,
          to: targetEmail,
          subject,
          html,
          text: bodyText || undefined,
          transactional: true,
        })

        if (!sent) {
          throw new Error(`Email delivery to ${targetEmail} failed (check SMTP / Gmail connection)`)
        }
        this.logger.log(`[Rule ${ruleId}] SEND_EMAIL delivered to ${targetEmail}: "${subject}"`)
        break
      }

      case 'SEND_SMS': {
        const phone = String(context['phone'] ?? context['customerPhone'] ?? params['phone'] ?? '').trim()
        const rawMessage = String(params['message'] ?? 'SPLARO notification')
        const message = this.interpolateTemplate(rawMessage, context)
        if (phone && this.sms) {
          const result = await this.sms.send(phone, message, storeId || undefined)
          if (!result.sent) {
            this.logger.warn(`[Rule ${ruleId}] SMS failed: ${result.error}`)
            throw new Error(`SMS delivery failed: ${result.error ?? 'unknown'}`)
          }
        }
        break
      }

      case 'SEND_WHATSAPP': {
        const phone = String(context['phone'] ?? params['phone'] ?? '')
        const rawMessage = String(params['message'] ?? 'SPLARO notification')
        const message = this.interpolateTemplate(rawMessage, context)
        this.logger.log(`[Rule ${ruleId}] SEND_WHATSAPP to ${phone}: ${message}`)
        break
      }

      case 'APPLY_TAG': {
        const customerId = String(context['customerId'] ?? '')
        const tag = String(params['tag'] ?? '').trim()
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
        const tag = String(params['tag'] ?? '').trim()
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
        const rawSubject = String(params['subject'] ?? 'Automation Rule Triggered')
        const rawBody = String(params['message'] ?? params['body'] ?? 'Automation triggered')
        const subject = this.interpolateTemplate(rawSubject, context)
        const body = this.interpolateTemplate(rawBody, context)
        await this.notifications?.notifyAdmin({ subject, body, storeId, level: 'info' })
        break
      }

      case 'UPDATE_ORDER_STATUS': {
        const orderId = String(context['orderId'] ?? '')
        const newStatus = String(params['status'] ?? '')
        if (!orderId || !newStatus) break
        if (!isOrderStatus(newStatus)) {
          this.logger.warn(
            `Automation UPDATE_ORDER_STATUS rejected — unknown status "${newStatus}" for order ${orderId}`,
          )
          throw new Error(`Unknown order status: ${newStatus}`)
        }
        await this.orderStatus.applyStatusChange(
          orderId,
          newStatus,
          `Automation rule ${ruleId}`,
          typeof context['storeId'] === 'string' ? context['storeId'] : undefined,
          { notePrefix: 'Automation: ' },
        )
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

  // ── ABANDONED CART SWEEP ───────────────────────────────────

  /**
   * Sweeps cart sessions that have had no activity for 2 hours and have items.
   * Marks isAbandoned = true and runs the ABANDONED_CART trigger once per session.
   */
  async sweepAbandonedCarts(targetStoreId?: string): Promise<{ swept: number }> {
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours
    const now = new Date()

    const sessions = await this.prisma.cartSession.findMany({
      where: {
        isAbandoned: false,
        expiresAt: { gt: now },
        updatedAt: { lte: cutoff },
        items: { some: {} },
        ...(targetStoreId ? { storeId: targetStoreId } : {}),
      },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, basePrice: true } },
            variant: { select: { id: true, price: true, size: true, color: true } },
          },
        },
      },
      take: 50,
    })

    let count = 0
    for (const session of sessions) {
      const storeId = session.storeId
      if (!storeId) continue

      // Mark abandoned first so concurrent sweeps don't double trigger
      await this.prisma.cartSession.update({
        where: { id: session.id },
        data: { isAbandoned: true },
      })

      const total = session.items.reduce(
        (sum, item) => sum + (Number(item.variant?.price ?? item.product?.basePrice ?? 0) * item.quantity),
        0,
      )
      const itemCount = session.items.reduce((sum, item) => sum + item.quantity, 0)
      const customerName = session.customer
        ? `${session.customer.firstName} ${session.customer.lastName}`.trim() || 'Valued Customer'
        : 'Valued Customer'

      const context: Record<string, unknown> = {
        cartId: session.id,
        sessionId: session.sessionId,
        storeId,
        customerId: session.customerId,
        customerName,
        email: session.customer?.email ?? null,
        phone: session.customer?.phone ?? null,
        total,
        itemCount,
        items: session.items.map((i) => ({
          productName: i.product?.name ?? 'Product',
          quantity: i.quantity,
          price: Number(i.variant?.price ?? i.product?.basePrice ?? 0),
        })),
        triggeredBy: 'scheduler',
      }

      await this.runTrigger(storeId, 'ABANDONED_CART', context)
      count += 1
    }

    return { swept: count }
  }

  // ── RULE CRUD ──────────────────────────────────────────────

  async createRule(storeId: string, data: {
    name: string
    description?: string
    trigger: AutomationTrigger
    conditions?: { field: string; operator: string; value: string }[]
    actions: { action: string; params: Record<string, unknown>; sortOrder: number }[]
  }) {
    return this.prisma.automationRule.create({
      data: {
        storeId,
        name: data.name,
        description: data.description,
        trigger: data.trigger,
        conditions: {
          create: (data.conditions ?? []).map(c => ({
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
      include: { conditions: true, actions: { orderBy: { sortOrder: 'asc' } } },
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
