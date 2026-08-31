import {
  formatEmailTaka,
  renderCalloutBlock,
  renderEmailLayout,
  renderLineItemsBlock,
  renderMetaBlock,
  renderNoteBlock,
  type EmailLineItem,
} from './email-layout.template'

/**
 * What a customer is told when their order or return moves.
 *
 * Placement already sends a full invoice; everything after it is a short note
 * saying where the parcel is and what happens next. Only the statuses a
 * customer would act on are listed — a shop moving an order from PENDING to
 * PROCESSING is bookkeeping, and mailing it trains people to ignore us.
 */
export interface OrderStatusCopy {
  eyebrow: string
  heading: string
  intro: string
  callout?: string
  subject: (invoiceNumber: string) => string
}

export const ORDER_STATUS_EMAILS: Record<string, OrderStatusCopy> = {
  CONFIRMED: {
    eyebrow: 'Order confirmed',
    heading: 'We have your order',
    intro: 'Your order is confirmed and going into packing. We will write again when it ships.',
    subject: (n) => `Order ${n} confirmed`,
  },
  SHIPPED: {
    eyebrow: 'On its way',
    heading: 'Your order has shipped',
    intro: 'Your parcel has left us and is with the courier now.',
    callout: 'Keep your phone reachable — the courier calls before delivering.',
    subject: (n) => `Order ${n} has shipped`,
  },
  COURIER_BOOKED: {
    eyebrow: 'Courier booked',
    heading: 'A courier has been booked',
    intro: 'Your parcel is booked for pickup and will be on the road shortly.',
    subject: (n) => `Order ${n} is booked with a courier`,
  },
  IN_TRANSIT: {
    eyebrow: 'In transit',
    heading: 'Your parcel is moving',
    intro: 'Your parcel is in transit with the courier.',
    subject: (n) => `Order ${n} is in transit`,
  },
  OUT_FOR_DELIVERY: {
    eyebrow: 'Out for delivery',
    heading: 'Arriving today',
    intro: 'Your parcel is out with the delivery rider today.',
    callout: 'Please keep your phone reachable and the payment ready if you chose cash on delivery.',
    subject: (n) => `Order ${n} is out for delivery`,
  },
  DELIVERED: {
    eyebrow: 'Delivered',
    heading: 'Your order was delivered',
    intro: 'Our records show this order reached you. We hope it is exactly what you wanted.',
    callout: 'If anything is wrong with what arrived, reply within seven days and we will sort it.',
    subject: (n) => `Order ${n} delivered`,
  },
  CANCELLED: {
    eyebrow: 'Cancelled',
    heading: 'Your order was cancelled',
    intro: 'This order has been cancelled and nothing will be dispatched against it.',
    callout: 'If you had already paid, the refund is being processed back the way you paid.',
    subject: (n) => `Order ${n} cancelled`,
  },
  RETURNED: {
    eyebrow: 'Returned',
    heading: 'Your return is back with us',
    intro: 'The parcel has come back to us and we are processing it.',
    subject: (n) => `Order ${n} returned`,
  },
  REFUNDED: {
    eyebrow: 'Refunded',
    heading: 'Your refund is on its way',
    intro: 'We have refunded this order back to the method you paid with.',
    callout: 'Bank and mobile-wallet refunds can take a few working days to appear.',
    subject: (n) => `Order ${n} refunded`,
  },
}

/**
 * A staff correction is not a status move, so it lives outside the status table:
 * the customer agreed to one order and is now being shown a different one, and
 * that has to arrive as its own document rather than as a "confirmed" repeat.
 */
export const ORDER_EDITED_EMAIL: OrderStatusCopy = {
  eyebrow: 'Order updated',
  heading: 'We have corrected your order',
  intro: 'Your order has been updated. The corrected details are below — this replaces what we sent you earlier.',
  callout: 'If any of this is still not what you wanted, reply to this email or call us before it ships.',
  subject: (n) => `Order ${n} updated`,
}

export interface OrderEditedEmailInput {
  customerName: string
  invoiceNumber: string
  items: EmailLineItem[]
  total: number
  /** Plain-language list of what staff changed. */
  changes: string[]
  note?: string | null
  trackUrl?: string | null
  storeName?: string
  siteUrl?: string
}

export function generateOrderEditedEmail(input: OrderEditedEmailInput): {
  subject: string
  html: string
  text: string
} {
  const changeLine = input.changes.length ? `What changed: ${input.changes.join(', ')}.` : ''
  const note = [changeLine, input.note?.trim()].filter(Boolean).join(' ')
  return generateOrderUpdateEmail({
    copy: ORDER_EDITED_EMAIL,
    customerName: input.customerName,
    reference: input.invoiceNumber,
    items: input.items,
    total: input.total,
    note: note || null,
    trackUrl: input.trackUrl ?? null,
    ...(input.storeName ? { storeName: input.storeName } : {}),
    ...(input.siteUrl ? { siteUrl: input.siteUrl } : {}),
  })
}

/** Return statuses worth a mail — the ones that change what the customer does. */
export const RMA_STATUS_EMAILS: Record<string, OrderStatusCopy> = {
  REQUESTED: {
    eyebrow: 'Return requested',
    heading: 'We have your return request',
    intro: 'Your request is logged and a member of the team is reviewing it.',
    subject: (n) => `Return ${n} received`,
  },
  APPROVED: {
    eyebrow: 'Return approved',
    heading: 'Your return is approved',
    intro: 'Send the item back to us, or hand it to the rider we send — whichever we agreed.',
    callout: 'Please send it back in the condition it arrived, with any tags still on.',
    subject: (n) => `Return ${n} approved`,
  },
  REJECTED: {
    eyebrow: 'Return declined',
    heading: 'We could not accept this return',
    intro: 'We have reviewed your request and cannot take this item back.',
    callout: 'If you think this is a mistake, reply to this email and we will look again.',
    subject: (n) => `Return ${n} declined`,
  },
  ITEM_RECEIVED: {
    eyebrow: 'Item received',
    heading: 'Your returned item is with us',
    intro: 'We have received the item back and are checking it now.',
    subject: (n) => `Return ${n} — item received`,
  },
  REFUNDED: {
    eyebrow: 'Refunded',
    heading: 'Your refund has been issued',
    intro: 'We have refunded this return back to the method you paid with.',
    callout: 'Bank and mobile-wallet refunds can take a few working days to appear.',
    subject: (n) => `Return ${n} refunded`,
  },
  EXCHANGED: {
    eyebrow: 'Exchanged',
    heading: 'Your exchange is on its way',
    intro: 'The replacement is on its way to you.',
    subject: (n) => `Return ${n} exchanged`,
  },
}

export interface OrderUpdateEmailInput {
  copy: OrderStatusCopy
  customerName: string
  /** Invoice number for an order, RMA number for a return. */
  reference: string
  items?: EmailLineItem[]
  total?: number | null
  /** Where the customer can see the order themselves. */
  trackUrl?: string | null
  courierName?: string | null
  trackingNumber?: string | null
  /** Anything the shop typed when moving the status. */
  note?: string | null
  storeName?: string
  siteUrl?: string
}

export function generateOrderUpdateEmail(input: OrderUpdateEmailInput): {
  subject: string
  html: string
  text: string
} {
  const store = input.storeName?.trim() || 'SPLARO'
  const copy = input.copy
  const name = input.customerName?.trim() || 'there'

  const meta: Array<[string, string]> = [['Reference', input.reference]]
  if (input.courierName?.trim()) meta.push(['Courier', input.courierName.trim()])
  if (input.trackingNumber?.trim()) meta.push(['Tracking', input.trackingNumber.trim()])
  if (input.total != null) meta.push(['Order total', formatEmailTaka(input.total)])

  const blocks = [
    renderMetaBlock(meta),
    ...(copy.callout ? [renderCalloutBlock(copy.callout)] : []),
    ...(input.items?.length ? [renderLineItemsBlock(input.items, 'What is in this order')] : []),
    renderNoteBlock('From the team', input.note?.trim() ?? ''),
  ]

  return {
    subject: copy.subject(input.reference),
    html: renderEmailLayout({
      eyebrow: copy.eyebrow,
      heading: copy.heading,
      intro: `${name}, ${lowerFirst(copy.intro)}`,
      preheader: `${input.reference} — ${copy.eyebrow.toLowerCase()}`,
      blocks,
      ...(input.trackUrl ? { action: { label: 'View your order', url: input.trackUrl } } : {}),
      footnote: `Sent by ${store} because you placed an order with us. Reply to this email if anything looks wrong.`,
      storeName: store,
      ...(input.siteUrl ? { siteUrl: input.siteUrl } : {}),
    }),
    text: [
      copy.subject(input.reference),
      '',
      `${name}, ${lowerFirst(copy.intro)}`,
      '',
      `Reference: ${input.reference}`,
      ...(input.courierName?.trim() ? [`Courier: ${input.courierName.trim()}`] : []),
      ...(input.trackingNumber?.trim() ? [`Tracking: ${input.trackingNumber.trim()}`] : []),
      ...(input.total != null ? [`Order total: ${formatEmailTaka(input.total)}`] : []),
      ...(copy.callout ? ['', copy.callout] : []),
      ...(input.note?.trim() ? ['', `From the team: ${input.note.trim()}`] : []),
      ...(input.trackUrl ? ['', `View your order: ${input.trackUrl}`] : []),
    ].join('\n'),
  }
}

/** "Your order is confirmed" reads wrong after a name; "your order is…" does not. */
function lowerFirst(sentence: string): string {
  if (!sentence) return sentence
  // Only the leading word, and only when it is a plain capitalised word — a
  // brand or an acronym at the start must survive untouched.
  const [first = '', ...rest] = sentence.split(' ')
  if (first.length > 1 && first === first[0] + first.slice(1).toLowerCase()) {
    return [first.toLowerCase(), ...rest].join(' ')
  }
  return sentence
}
