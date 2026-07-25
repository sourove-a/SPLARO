import {
  PAYMENT_CODE_START,
  formatPayCode,
  isPayCode,
  needsPaymentCodeBackfill,
  parsePayNumber,
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

async function findHighestPayNumber(db: Db, storeId: string): Promise<number> {
  try {
    const rows = await db.$queryRaw<Array<{ max: number | null }>>`
      SELECT MAX(
        CAST(NULLIF(regexp_replace(p."paymentNumber", '[^0-9]', '', 'g'), '') AS INTEGER)
      ) AS max
      FROM "Payment" p
      INNER JOIN "Order" o ON o.id = p."orderId"
      WHERE o."storeId" = ${storeId}
        AND p."paymentNumber" ILIKE 'PAY-%'
    `
    const max = rows[0]?.max
    if (typeof max === 'number' && Number.isFinite(max)) return max
  } catch {
    // fall through
  }

  const recent = await db.payment.findMany({
    where: {
      order: { storeId },
      paymentNumber: { startsWith: 'PAY-', mode: 'insensitive' },
    },
    select: { paymentNumber: true },
    orderBy: { createdAt: 'desc' },
    take: 48,
  })

  let max = PAYMENT_CODE_START - 1
  for (const row of recent) {
    const n = row.paymentNumber ? parsePayNumber(row.paymentNumber) : null
    if (n !== null && n > max) max = n
  }
  return max
}

/** Next PAY-#### for a store. Uniqueness via Payment.paymentNumber + caller retry. */
export async function generatePaymentCode(db: Db, storeId: string): Promise<string> {
  const next = Math.max(PAYMENT_CODE_START, (await findHighestPayNumber(db, storeId)) + 1)
  return formatPayCode(next)
}

/** Assign PAY-#### to legacy payments that still lack a serial code. */
export async function backfillPaymentCodes(
  db: Db,
  storeId: string,
  limit = 25,
): Promise<number> {
  const rows = await db.payment.findMany({
    where: { order: { storeId } },
    select: { id: true, paymentNumber: true },
    orderBy: { createdAt: 'asc' },
    take: Math.max(limit * 4, 50),
  })

  let fixed = 0
  for (const row of rows) {
    if (fixed >= limit) break
    if (!needsPaymentCodeBackfill(row.paymentNumber)) continue

    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = await generatePaymentCode(db, storeId)
      try {
        await db.payment.update({
          where: { id: row.id },
          data: { paymentNumber: candidate },
        })
        fixed++
        break
      } catch (error) {
        if (!isUniqueViolation(error, 'paymentNumber')) throw error
      }
    }
  }

  return fixed
}

export { isPayCode, needsPaymentCodeBackfill }
