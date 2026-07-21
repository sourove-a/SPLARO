import {
  ORDER_CODE_START,
  formatSplOrderCode,
  isSplOrderCode,
  needsInvoiceCodeBackfill,
  parseSplOrderNumber,
} from '@splaro/config'
import type { Prisma, PrismaClient } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

function isUniqueViolation(error: unknown, field?: string): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false
  if ((error as { code: string }).code !== 'P2002') return false
  if (!field) return true
  const target = (error as { meta?: { target?: string[] } }).meta?.target
  return Array.isArray(target) && target.includes(field)
}

/**
 * Highest SPL-#### for a store — O(1) Postgres MAX, not a full table pull.
 * Falls back to a short recent window if raw SQL is unavailable.
 */
async function findHighestSplNumber(db: Db, storeId: string): Promise<number> {
  try {
    const rows = await db.$queryRaw<Array<{ max: number | null }>>`
      SELECT MAX(
        CAST(NULLIF(regexp_replace("invoiceNumber", '[^0-9]', '', 'g'), '') AS INTEGER)
      ) AS max
      FROM "Order"
      WHERE "storeId" = ${storeId}
        AND "invoiceNumber" ILIKE 'SPL-%'
    `
    const max = rows[0]?.max
    if (typeof max === 'number' && Number.isFinite(max)) return max
  } catch {
    // Transaction / driver edge — fall through to bounded scan.
  }

  const recent = await db.order.findMany({
    where: {
      storeId,
      invoiceNumber: { startsWith: 'SPL-', mode: 'insensitive' },
    },
    select: { invoiceNumber: true },
    orderBy: { createdAt: 'desc' },
    take: 48,
  })

  let max = ORDER_CODE_START - 1
  for (const row of recent) {
    const n = parseSplOrderNumber(row.invoiceNumber)
    if (n !== null && n > max) max = n
  }
  return max
}

/**
 * Next SPL-#### candidate. Uniqueness is enforced by the Order.invoiceNumber
 * unique constraint + caller retry — no per-candidate findUnique round-trips.
 */
export async function generateOrderCode(db: Db, storeId: string): Promise<string> {
  const next = Math.max(ORDER_CODE_START, (await findHighestSplNumber(db, storeId)) + 1)
  return formatSplOrderCode(next)
}

/** Assign SPL-#### to legacy orders that still expose raw ids or non-SPL codes. */
export async function backfillOrderInvoiceCodes(
  db: Db,
  storeId: string,
  limit = 25,
): Promise<number> {
  const rows = await db.order.findMany({
    where: { storeId },
    select: { id: true, invoiceNumber: true },
    orderBy: { createdAt: 'asc' },
    take: Math.max(limit * 4, 50),
  })

  let fixed = 0
  for (const row of rows) {
    if (fixed >= limit) break
    if (!needsInvoiceCodeBackfill(row.invoiceNumber, row.id)) continue

    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = await generateOrderCode(db, storeId)
      try {
        await db.order.update({
          where: { id: row.id },
          data: { invoiceNumber: candidate },
        })
        fixed++
        break
      } catch (error) {
        if (!isUniqueViolation(error, 'invoiceNumber')) throw error
      }
    }
  }

  return fixed
}

export { isSplOrderCode, needsInvoiceCodeBackfill }
