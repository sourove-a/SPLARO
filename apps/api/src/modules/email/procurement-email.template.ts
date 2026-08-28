import {
  escapeHtml,
  formatEmailDate,
  formatEmailTaka,
  renderCalloutBlock,
  renderEmailLayout,
  renderLineItemsBlock,
  renderMetaBlock,
  renderNoteBlock,
  renderTotalsBlock,
  type EmailLineItem,
} from './email-layout.template'

/**
 * The four documents a supplier ever receives from Procurement.
 *
 * They share one builder rather than living in four files because they are the
 * same document at different points in its life — the same PO number, the same
 * lines, the same supplier — and a supplier who gets a purchase order and then
 * a receiving note should recognise the second as the same paperwork. Splitting
 * them is how the wording and the money formatting drift apart.
 */
export type ProcurementEmailKind =
  | 'purchase-order'
  | 'goods-received'
  | 'payment-receipt'
  | 'purchase-cancelled'

export interface ProcurementEmailTotals {
  subtotal: number
  discount: number
  transportCost: number
  otherCost: number
  total: number
  paidAmount: number
  dueAmount: number
}

export interface ProcurementEmailInput {
  kind: ProcurementEmailKind
  supplierName: string
  poNumber: string
  purchasedAt: Date | string
  expectedAt?: Date | string | null
  items: EmailLineItem[]
  totals: ProcurementEmailTotals
  /** Operator's note on the PO — carried through verbatim. */
  notes?: string | null

  /** goods-received */
  grnNumber?: string | null
  receivedAt?: Date | string | null

  /** payment-receipt */
  payment?: {
    amount: number
    method?: string | null
    reference?: string | null
    paidAt: Date | string
    /** What the supplier is still owed across every purchase, after this. */
    balanceDue: number
  }

  /** Who the supplier replies to. */
  storeName?: string
  storePhone?: string | null
  storeEmail?: string | null
  siteUrl?: string
}

interface BuiltEmail {
  subject: string
  html: string
  text: string
}

export function generateProcurementEmail(input: ProcurementEmailInput): BuiltEmail {
  const store = input.storeName?.trim() || 'SPLARO'
  const contactRows: Array<[string, string]> = []
  if (input.storePhone?.trim()) contactRows.push(['Call', input.storePhone.trim()])
  if (input.storeEmail?.trim()) contactRows.push(['Email', input.storeEmail.trim()])

  switch (input.kind) {
    case 'goods-received':
      return buildGoodsReceived(input, store, contactRows)
    case 'payment-receipt':
      return buildPaymentReceipt(input, store, contactRows)
    case 'purchase-cancelled':
      return buildCancelled(input, store, contactRows)
    case 'purchase-order':
    default:
      return buildPurchaseOrder(input, store, contactRows)
  }
}

/** Money rows shared by the order and the cancellation, in printing order. */
function totalsRows(totals: ProcurementEmailTotals) {
  return [
    { label: 'Goods subtotal', value: totals.subtotal },
    { label: 'Discount', value: -Math.abs(totals.discount), hideWhenZero: true },
    { label: 'Transport', value: totals.transportCost, hideWhenZero: true },
    { label: 'Other charges', value: totals.otherCost, hideWhenZero: true },
    { label: 'Order total', value: totals.total, emphasis: true },
    { label: 'Paid now', value: totals.paidAmount, hideWhenZero: true },
    { label: 'Balance due', value: totals.dueAmount, hideWhenZero: true },
  ]
}

function buildPurchaseOrder(
  input: ProcurementEmailInput,
  store: string,
  contactRows: Array<[string, string]>,
): BuiltEmail {
  const eta = input.expectedAt ? formatEmailDate(input.expectedAt) : null
  const blocks = [
    renderMetaBlock([
      ['PO number', input.poNumber],
      ['Raised', formatEmailDate(input.purchasedAt)],
      ['Delivery expected', eta ?? 'To be confirmed'],
      ...contactRows,
    ]),
    renderLineItemsBlock(input.items, 'Goods ordered'),
    renderTotalsBlock(totalsRows(input.totals)),
    eta
      ? renderCalloutBlock(
          `Please confirm this order and deliver by ${eta}. If that date does not work, tell us now rather than on the day — we will move it.`,
        )
      : renderCalloutBlock(
          'Please confirm this order and let us know the delivery date you can hold to.',
        ),
    renderNoteBlock('Note', input.notes?.trim() ?? ''),
  ]

  return {
    subject: `Purchase order ${input.poNumber} from ${store}`,
    html: renderEmailLayout({
      eyebrow: 'Purchase order',
      heading: input.poNumber,
      intro: `${input.supplierName}, this is our order in writing. Everything below is what we have recorded on our side — check it against yours before you dispatch.`,
      preheader: `${input.poNumber} · ${formatEmailTaka(input.totals.total)}${eta ? ` · due ${eta}` : ''}`,
      blocks,
      footnote: `Raised by ${store}. Reply to this email if any line, rate or date is wrong — a correction now is cheaper than a return later.`,
      storeName: store,
      ...(input.siteUrl ? { siteUrl: input.siteUrl } : {}),
    }),
    text: [
      `Purchase order ${input.poNumber} from ${store}`,
      '',
      `${input.supplierName}, this is our order in writing.`,
      '',
      `Raised: ${formatEmailDate(input.purchasedAt)}`,
      `Delivery expected: ${eta ?? 'to be confirmed'}`,
      '',
      ...textLines(input.items),
      '',
      `Order total: ${formatEmailTaka(input.totals.total)}`,
      `Paid now: ${formatEmailTaka(input.totals.paidAmount)}`,
      `Balance due: ${formatEmailTaka(input.totals.dueAmount)}`,
      ...(input.notes?.trim() ? ['', `Note: ${input.notes.trim()}`] : []),
      '',
      'Reply to this email if any line, rate or date is wrong.',
    ].join('\n'),
  }
}

function buildGoodsReceived(
  input: ProcurementEmailInput,
  store: string,
  contactRows: Array<[string, string]>,
): BuiltEmail {
  // Prices are deliberately dropped: this document exists to agree on
  // quantities, and re-printing rates invites a rate argument at delivery.
  const quantitiesOnly: EmailLineItem[] = input.items.map((item) => ({
    name: item.name,
    detail: item.detail ?? null,
    quantity: item.quantity,
  }))

  const blocks = [
    renderMetaBlock([
      ['GRN number', input.grnNumber?.trim() || '—'],
      ['Against PO', input.poNumber],
      ['Received', formatEmailDate(input.receivedAt ?? new Date())],
      ...contactRows,
    ]),
    renderLineItemsBlock(quantitiesOnly, 'Goods received'),
    input.totals.dueAmount > 0
      ? renderCalloutBlock(
          `Stock is in and counted. ${formatEmailTaka(input.totals.dueAmount)} remains outstanding on ${input.poNumber}.`,
        )
      : renderCalloutBlock(`Stock is in and counted, and ${input.poNumber} is fully settled.`),
  ]

  return {
    subject: `Goods received against ${input.poNumber} — ${store}`,
    html: renderEmailLayout({
      eyebrow: 'Goods received',
      heading: input.grnNumber?.trim() || `Received · ${input.poNumber}`,
      intro: `${input.supplierName}, we have taken your delivery into stock. These are the quantities we counted in.`,
      preheader: `${input.poNumber} received${input.grnNumber ? ` · ${input.grnNumber}` : ''}`,
      blocks,
      footnote: `If a quantity here does not match your challan, reply within a day so we can recount together while the delivery is still traceable.`,
      storeName: store,
      ...(input.siteUrl ? { siteUrl: input.siteUrl } : {}),
    }),
    text: [
      `Goods received against ${input.poNumber} — ${store}`,
      '',
      `${input.supplierName}, we have taken your delivery into stock.`,
      '',
      ...(input.grnNumber ? [`GRN: ${input.grnNumber}`] : []),
      `Received: ${formatEmailDate(input.receivedAt ?? new Date())}`,
      '',
      ...quantitiesOnly.map((item) => `- ${item.name} x ${item.quantity}`),
      '',
      `Balance due on this PO: ${formatEmailTaka(input.totals.dueAmount)}`,
      '',
      'If a quantity does not match your challan, reply within a day.',
    ].join('\n'),
  }
}

function buildPaymentReceipt(
  input: ProcurementEmailInput,
  store: string,
  contactRows: Array<[string, string]>,
): BuiltEmail {
  const payment = input.payment
  const amount = payment?.amount ?? 0
  const balance = payment?.balanceDue ?? input.totals.dueAmount

  const blocks = [
    renderMetaBlock([
      ['Paid on', formatEmailDate(payment?.paidAt ?? new Date())],
      ['Against PO', input.poNumber],
      ['Method', payment?.method?.trim() || 'Not stated'],
      ['Reference', payment?.reference?.trim() || '—'],
      ...contactRows,
    ]),
    renderTotalsBlock([
      { label: 'Amount paid', value: amount, emphasis: true },
      { label: 'Balance still owed to you', value: balance },
    ]),
    balance > 0
      ? renderCalloutBlock(
          `After this payment we still owe you ${formatEmailTaka(balance)}. If your books say otherwise, reply and we will reconcile.`,
        )
      : renderCalloutBlock('This settles your account with us in full. Thank you.'),
  ]

  return {
    subject: `Payment sent — ${formatEmailTaka(amount)} against ${input.poNumber}`,
    html: renderEmailLayout({
      eyebrow: 'Payment receipt',
      heading: formatEmailTaka(amount),
      intro: `${input.supplierName}, we have recorded this payment against ${input.poNumber}. Keep this as your receipt.`,
      preheader: `${formatEmailTaka(amount)} paid against ${input.poNumber}`,
      blocks,
      footnote: `Recorded by ${store}. This is our record of the payment, not a bank confirmation — check your account before releasing further goods.`,
      storeName: store,
      ...(input.siteUrl ? { siteUrl: input.siteUrl } : {}),
    }),
    text: [
      `Payment sent — ${formatEmailTaka(amount)} against ${input.poNumber}`,
      '',
      `${input.supplierName}, we have recorded this payment.`,
      '',
      `Paid on: ${formatEmailDate(payment?.paidAt ?? new Date())}`,
      `Method: ${payment?.method?.trim() || 'not stated'}`,
      ...(payment?.reference?.trim() ? [`Reference: ${payment.reference.trim()}`] : []),
      '',
      `Amount paid: ${formatEmailTaka(amount)}`,
      `Balance still owed to you: ${formatEmailTaka(balance)}`,
      '',
      'This is our record of the payment, not a bank confirmation.',
    ].join('\n'),
  }
}

function buildCancelled(
  input: ProcurementEmailInput,
  store: string,
  contactRows: Array<[string, string]>,
): BuiltEmail {
  const blocks = [
    renderMetaBlock([
      ['Cancelled PO', input.poNumber],
      ['Originally raised', formatEmailDate(input.purchasedAt)],
      ['Was worth', formatEmailTaka(input.totals.total)],
      ...contactRows,
    ]),
    renderCalloutBlock(
      'Please do not dispatch against this order. If it has already left your shop, call us straight away rather than replying to this email.',
      'warn',
    ),
    renderLineItemsBlock(input.items, 'Cancelled lines'),
  ]

  return {
    subject: `Cancelled — purchase order ${input.poNumber}`,
    html: renderEmailLayout({
      eyebrow: 'Order cancelled',
      heading: `${input.poNumber} is cancelled`,
      intro: `${input.supplierName}, this order has been withdrawn on our side and the amount has been taken back off your balance with us.`,
      preheader: `${input.poNumber} withdrawn — do not dispatch`,
      blocks,
      footnote: `Withdrawn by ${store}. A replacement order, if we raise one, will carry a new PO number — do not supply against this one.`,
      storeName: store,
      ...(input.siteUrl ? { siteUrl: input.siteUrl } : {}),
    }),
    text: [
      `Cancelled — purchase order ${input.poNumber}`,
      '',
      `${input.supplierName}, this order has been withdrawn on our side.`,
      '',
      'Please do not dispatch against it. If it has already left your shop, call us straight away.',
      '',
      `Originally raised: ${formatEmailDate(input.purchasedAt)}`,
      `Was worth: ${formatEmailTaka(input.totals.total)}`,
      '',
      'A replacement order, if we raise one, will carry a new PO number.',
    ].join('\n'),
  }
}

function textLines(items: EmailLineItem[]): string[] {
  return items.map((item) => {
    const rate = item.unitCost == null ? '' : ` @ ${formatEmailTaka(item.unitCost)}`
    const total = item.lineTotal == null ? '' : ` = ${formatEmailTaka(item.lineTotal)}`
    return `- ${item.name} x ${item.quantity}${rate}${total}`
  })
}

/** Re-exported so callers building line items do not reach into the layout. */
export type { EmailLineItem }
export { escapeHtml }
