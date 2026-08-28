import { Injectable, Logger, Optional } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { EmailService } from '../email/email.service'
import {
  generateProcurementEmail,
  type ProcurementEmailInput,
  type ProcurementEmailKind,
} from '../email/procurement-email.template'
import type { EmailLineItem } from '../email/email-layout.template'
import { resolveCustomerFacingSiteUrl } from '@splaro/config'

/**
 * Why a mail did or did not reach the supplier.
 *
 * Every procurement write returns one of these rather than a bare boolean: the
 * operator raising a purchase order has to know whether the supplier actually
 * has it, and "no email address on file" and "SMTP is down" are two completely
 * different things to do something about.
 */
export interface SupplierMailResult {
  emailed: boolean
  reason: 'sent' | 'no-address' | 'skipped' | 'failed'
  /** A sentence the admin toast can show as-is. */
  detail: string
  to?: string
}

const SKIPPED: SupplierMailResult = {
  emailed: false,
  reason: 'skipped',
  detail: 'Email to the supplier was not requested.',
}

export interface ProcurementMailPayload {
  kind: ProcurementEmailKind
  supplier: { name: string; email?: string | null }
  poNumber: string
  purchasedAt: Date | string
  expectedAt?: Date | string | null
  items: EmailLineItem[]
  totals: ProcurementEmailInput['totals']
  notes?: string | null
  grnNumber?: string | null
  receivedAt?: Date | string | null
  payment?: ProcurementEmailInput['payment']
}

@Injectable()
export class ProcurementMailerService {
  private readonly logger = new Logger(ProcurementMailerService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly email?: EmailService,
  ) {}

  /**
   * Send one procurement document.
   *
   * Never throws. A supplier email failing is a thing to tell the operator
   * about, not a reason to fail the purchase order that was already written —
   * the money and the stock are committed by the time this runs.
   */
  async send(storeId: string, payload: ProcurementMailPayload): Promise<SupplierMailResult> {
    const to = payload.supplier.email?.trim()
    if (!to || !to.includes('@')) {
      return {
        emailed: false,
        reason: 'no-address',
        detail: `${payload.supplier.name} has no email address on file — add one to send them paperwork.`,
      }
    }
    if (!this.email) {
      return {
        emailed: false,
        reason: 'failed',
        detail: 'The email service is not available on this deployment.',
      }
    }

    try {
      const store = await this.prisma.store.findUnique({
        where: { id: storeId },
        select: { name: true, phone: true, email: true },
      })

      const built = generateProcurementEmail({
        kind: payload.kind,
        supplierName: payload.supplier.name,
        poNumber: payload.poNumber,
        purchasedAt: payload.purchasedAt,
        expectedAt: payload.expectedAt ?? null,
        items: payload.items,
        totals: payload.totals,
        notes: payload.notes ?? null,
        grnNumber: payload.grnNumber ?? null,
        receivedAt: payload.receivedAt ?? null,
        ...(payload.payment ? { payment: payload.payment } : {}),
        storeName: store?.name ?? 'SPLARO',
        storePhone: store?.phone ?? null,
        storeEmail: store?.email ?? null,
        siteUrl: resolveCustomerFacingSiteUrl(),
      })

      const sent = await this.email.sendForStore({
        storeId,
        to,
        subject: built.subject,
        html: built.html,
        text: built.text,
        // Supplier paperwork goes out even when the storefront's marketing
        // email switch is off — it is correspondence about money owed, not
        // promotion.
        transactional: true,
        level: 'warn',
      })

      if (sent) {
        return { emailed: true, reason: 'sent', detail: `Emailed to ${to}.`, to }
      }
      return {
        emailed: false,
        reason: 'failed',
        detail: `Could not email ${to} — no working SMTP account or Gmail connection.`,
        to,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Supplier email failed'
      this.logger.error(`Supplier email for ${payload.poNumber} failed: ${message}`)
      return {
        emailed: false,
        reason: 'failed',
        detail: `Could not email ${to} — ${message}`,
        to,
      }
    }
  }

  /** The opt-out path, so callers do not each re-invent "was it asked for?". */
  skipped(): SupplierMailResult {
    return SKIPPED
  }

  /**
   * Load a purchase order and send a document for it.
   *
   * Used where the row still exists at send time (resend, receive, payment).
   * A deletion cannot use this — the row is gone by then — so that path builds
   * the payload from what it captured before the delete.
   */
  async sendForPurchaseOrder(
    storeId: string,
    purchaseOrderId: string,
    kind: ProcurementEmailKind,
    extras: Pick<ProcurementMailPayload, 'grnNumber' | 'receivedAt' | 'payment'> = {},
  ): Promise<SupplierMailResult> {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, storeId },
      include: { items: true, supplier: { select: { name: true, email: true } } },
    })
    if (!po) {
      return {
        emailed: false,
        reason: 'failed',
        detail: 'Purchase order not found, so nothing could be emailed.',
      }
    }

    return this.send(storeId, {
      kind,
      supplier: { name: po.supplier.name, email: po.supplier.email },
      poNumber: po.poNumber,
      purchasedAt: po.purchasedAt,
      expectedAt: po.expectedAt,
      items: toEmailLineItems(po.items),
      totals: {
        subtotal: Number(po.subtotal),
        discount: Number(po.discount),
        transportCost: Number(po.transportCost),
        otherCost: Number(po.otherCost),
        total: Number(po.total),
        paidAmount: Number(po.paidAmount),
        dueAmount: Number(po.dueAmount),
      },
      notes: po.notes,
      ...extras,
    })
  }
}

/** Purchase lines as the email templates want them, Decimals flattened. */
export function toEmailLineItems(
  items: Array<{
    productName: string
    sku: string | null
    quantity: number
    unitCost: unknown
    lineTotal: unknown
  }>,
): EmailLineItem[] {
  return items.map((item) => ({
    name: item.productName,
    detail: item.sku,
    quantity: item.quantity,
    unitCost: Number(item.unitCost),
    lineTotal: Number(item.lineTotal),
  }))
}
