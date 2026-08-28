/**
 * Procurement arithmetic, kept free of Prisma so it can be tested without a
 * database.
 *
 * Money is handled in integer paisa inside this file. A purchase adds a line
 * total, a discount, transport and "other" cost, then splits the result into
 * paid and due — five float additions is all it takes for 1200.00 to come out
 * as 1199.9999999999998 and for a supplier balance to drift a paisa per entry.
 */

/** Two-decimal money as an integer count of paisa. */
export type Paisa = number

export function toPaisa(value: unknown): Paisa {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

export function fromPaisa(value: Paisa): number {
  return Math.round(value) / 100
}

export interface PurchaseItemInput {
  productId?: string | null
  variantId?: string | null
  productName?: string | null
  sku?: string | null
  quantity?: unknown
  unitCost?: unknown
}

export interface NormalizedPurchaseItem {
  productId: string | null
  variantId: string | null
  productName: string
  sku: string | null
  quantity: number
  unitCostPaisa: Paisa
  lineTotalPaisa: Paisa
}

/**
 * Drop unusable lines and clamp the rest.
 *
 * A line with no name and no catalog link cannot be reported on later, so it is
 * dropped rather than stored as an empty row. Quantity floors at 1 because a
 * zero-quantity purchase line is always a typo, never an intent.
 */
export function normalizePurchaseItems(items: PurchaseItemInput[]): NormalizedPurchaseItem[] {
  const out: NormalizedPurchaseItem[] = []
  for (const raw of items ?? []) {
    const productId = raw.productId?.trim() || null
    const variantId = raw.variantId?.trim() || null
    const productName = raw.productName?.trim() || ''
    const sku = raw.sku?.trim() || null
    if (!productName && !productId && !variantId) continue

    const quantity = Math.max(1, Math.floor(Number(raw.quantity) || 0))
    const unitCostPaisa = Math.max(0, toPaisa(raw.unitCost))
    out.push({
      productId,
      variantId,
      productName,
      sku,
      quantity,
      unitCostPaisa,
      lineTotalPaisa: unitCostPaisa * quantity,
    })
  }
  return out
}

export interface PurchaseChargeInput {
  discount?: unknown
  transportCost?: unknown
  otherCost?: unknown
  paidAmount?: unknown
}

export interface PurchaseTotals {
  subtotal: number
  discount: number
  transportCost: number
  otherCost: number
  total: number
  paidAmount: number
  dueAmount: number
}

/**
 * Compute every money field server-side.
 *
 * The client sends line quantities and costs; it never sends a total. Trusting
 * a client-supplied total would let a tampered request record a 50,000 tk
 * purchase as 50 tk and silently corrupt the supplier balance.
 */
export function computePurchaseTotals(
  items: NormalizedPurchaseItem[],
  charges: PurchaseChargeInput = {},
): PurchaseTotals {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotalPaisa, 0)

  // A discount larger than the goods themselves is a typo; clamping keeps the
  // total from going negative and inverting the supplier's balance.
  const discount = Math.min(subtotal, Math.max(0, toPaisa(charges.discount)))
  const transportCost = Math.max(0, toPaisa(charges.transportCost))
  const otherCost = Math.max(0, toPaisa(charges.otherCost))

  const total = subtotal - discount + transportCost + otherCost

  // Overpayment is clamped rather than carried as negative due — an advance to
  // a supplier is a different transaction than settling this purchase.
  const paidAmount = Math.min(total, Math.max(0, toPaisa(charges.paidAmount)))
  const dueAmount = total - paidAmount

  return {
    subtotal: fromPaisa(subtotal),
    discount: fromPaisa(discount),
    transportCost: fromPaisa(transportCost),
    otherCost: fromPaisa(otherCost),
    total: fromPaisa(total),
    paidAmount: fromPaisa(paidAmount),
    dueAmount: fromPaisa(dueAmount),
  }
}

/**
 * Next value for a padded human reference (SUP-0007, PO-0042).
 *
 * Derived from the highest existing number rather than a row count: counting
 * reuses a number as soon as a row is deleted, and the unique index then
 * rejects the next insert.
 */
export function nextSequenceCode(prefix: string, existing: Array<string | null | undefined>): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`, 'i')
  let highest = 0
  for (const code of existing) {
    const match = pattern.exec(code?.trim() ?? '')
    if (!match) continue
    const n = Number(match[1])
    if (Number.isFinite(n) && n > highest) highest = n
  }
  return `${prefix}-${String(highest + 1).padStart(4, '0')}`
}

/** Bangladeshi mobile numbers, compared on digits so 01712-345678 == +8801712345678. */
export function normalizePhone(phone?: string | null): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('880') && digits.length === 13) return `0${digits.slice(3)}`
  if (digits.startsWith('0') && digits.length === 11) return digits
  return digits
}

export interface SupplierBalance {
  dueAmount: number
  paidAmount: number
}

/**
 * Apply a payment to a supplier balance.
 *
 * Paying more than is owed leaves due at zero rather than negative: the extra
 * is still recorded as paid, so the ledger stays honest about cash out, but the
 * balance never claims the supplier owes the store money.
 */
export function applyPaymentToBalance(
  balance: SupplierBalance,
  amount: unknown,
): SupplierBalance & { appliedToDue: number } {
  const paid = Math.max(0, toPaisa(amount))
  const due = Math.max(0, toPaisa(balance.dueAmount))
  const alreadyPaid = Math.max(0, toPaisa(balance.paidAmount))
  const appliedToDue = Math.min(due, paid)

  return {
    dueAmount: fromPaisa(due - appliedToDue),
    paidAmount: fromPaisa(alreadyPaid + paid),
    appliedToDue: fromPaisa(appliedToDue),
  }
}

/**
 * Move a supplier balance by a newly recorded purchase.
 *
 * The liability exists the moment goods are bought, not when they are received,
 * so this runs at purchase entry. Anything paid at entry counts as cash out and
 * never lands in due.
 */
export function applyPurchaseToBalance(
  balance: SupplierBalance,
  totals: { dueAmount: number; paidAmount: number },
): SupplierBalance {
  const due = Math.max(0, toPaisa(balance.dueAmount)) + Math.max(0, toPaisa(totals.dueAmount))
  const paid = Math.max(0, toPaisa(balance.paidAmount)) + Math.max(0, toPaisa(totals.paidAmount))
  return { dueAmount: fromPaisa(due), paidAmount: fromPaisa(paid) }
}

/**
 * Which purchase lines can actually move stock.
 *
 * Stock lives on ProductVariant, so a line naming only a product — or only a
 * free-text name — records cost but cannot move inventory. Callers surface the
 * skipped count so the operator is told, rather than quietly believing stock
 * went up.
 */
export function splitStockableItems<T extends { variantId: string | null; sku: string | null }>(
  items: T[],
): { stockable: T[]; skipped: T[] } {
  const stockable: T[] = []
  const skipped: T[] = []
  for (const item of items) {
    if (item.variantId || item.sku) stockable.push(item)
    else skipped.push(item)
  }
  return { stockable, skipped }
}

/**
 * The expected delivery date for a purchase.
 *
 * An explicit date always wins — the supplier said it on the phone. With none,
 * the supplier's measured lead time gives one; with neither, the answer is null
 * rather than a guessed date, because a fabricated ETA reads on screen exactly
 * like one the supplier actually promised.
 */
export function resolveExpectedAt(input: {
  expectedAt?: unknown
  purchasedAt: Date
  leadTimeDays?: number | null
}): Date | null {
  if (input.expectedAt !== undefined && input.expectedAt !== null && input.expectedAt !== '') {
    const typed = new Date(input.expectedAt as string)
    if (Number.isNaN(typed.getTime())) return null
    return typed
  }
  const lead = Number(input.leadTimeDays)
  if (!Number.isFinite(lead) || lead <= 0) return null
  return new Date(input.purchasedAt.getTime() + Math.floor(lead) * 86_400_000)
}

export type EtaState = 'none' | 'due' | 'today' | 'late'

/**
 * How an ETA reads against today, in whole days.
 *
 * Both sides are floored to midnight first: comparing raw timestamps makes a
 * PO raised at 6pm for "tomorrow" report 0 days left, which an operator reads
 * as "due today" and acts on a day early.
 */
export function describeEta(expectedAt: Date | string | null | undefined, now: Date = new Date()): {
  state: EtaState
  days: number
} {
  if (!expectedAt) return { state: 'none', days: 0 }
  const target = expectedAt instanceof Date ? expectedAt : new Date(expectedAt)
  if (Number.isNaN(target.getTime())) return { state: 'none', days: 0 }

  const midnight = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const days = Math.round((midnight(target) - midnight(now)) / 86_400_000)
  if (days === 0) return { state: 'today', days: 0 }
  if (days < 0) return { state: 'late', days: Math.abs(days) }
  return { state: 'due', days }
}

/**
 * Undo a purchase's effect on the supplier balance.
 *
 * Fed the purchase's *current* due and paid, not the amounts it was raised
 * with: later payments moved both the PO and the supplier in lockstep, so the
 * current pair is the exact contribution this purchase still makes. Both sides
 * clamp at zero — a balance edited by hand elsewhere must not go negative and
 * invert who owes whom.
 */
export function reversePurchaseFromBalance(
  balance: SupplierBalance,
  purchase: { dueAmount: unknown; paidAmount: unknown },
): SupplierBalance {
  const due = Math.max(0, toPaisa(balance.dueAmount) - Math.max(0, toPaisa(purchase.dueAmount)))
  const paid = Math.max(0, toPaisa(balance.paidAmount) - Math.max(0, toPaisa(purchase.paidAmount)))
  return { dueAmount: fromPaisa(due), paidAmount: fromPaisa(paid) }
}

/**
 * Take back stock a deleted purchase had added.
 *
 * Some of it may already have been sold, so the full quantity cannot always
 * come back out. Removing what is actually there and reporting that number
 * keeps the movement log honest instead of writing a negative shelf.
 */
export function reverseStockDelta(
  currentStock: number,
  received: number,
): { quantityAfter: number; removed: number } {
  const removable = Math.min(Math.max(0, Math.floor(received)), Math.max(0, currentStock))
  return { quantityAfter: currentStock - removable, removed: removable }
}

/**
 * Supplier lead time in whole days, or null.
 *
 * Zero and negatives collapse to null rather than to "arrives the same day" —
 * a cleared field and a same-day supplier must not read the same on screen.
 */
export function normalizeLeadTimeDays(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(365, n)
}
