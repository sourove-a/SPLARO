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

async function findHighestSplNumber(db: Db, storeId: string): Promise<number> {
  const orders = await db.order.findMany({
    where: {
      storeId,
      invoiceNumber: { startsWith: 'SPL-', mode: 'insensitive' },
    },
    select: { invoiceNumber: true },
  })

  let max = ORDER_CODE_START - 1
  for (const row of orders) {
    const n = parseSplOrderNumber(row.invoiceNumber)
    if (n !== null && n > max) max = n
  }
  return max
}

/**
 * Generate the next unique SPL-#### code for a store.
 * Retries when a concurrent checkout claims the same number.
 */
export async function generateOrderCode(db: Db, storeId: string, maxAttempts = 12): Promise<string> {
  let next = Math.max(ORDER_CODE_START, (await findHighestSplNumber(db, storeId)) + 1)

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = formatSplOrderCode(next)
    const clash = await db.order.findUnique({
      where: { invoiceNumber: candidate },
      select: { id: true },
    })
    if (!clash) return candidate
    next++
  }

  throw new Error('Unable to generate a unique order code — try again')
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
