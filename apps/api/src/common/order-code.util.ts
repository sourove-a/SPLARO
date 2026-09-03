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

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'bigint') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function orderSequenceKey(_storeId: string): string {
  return 'order:global'
}

/**
 * Highest SPL-#### across the platform — O(1) Postgres MAX, not a full table pull.
 * Used only to seed / catch up CodeSequence; the counter never decrements.
 */
async function findHighestSplNumber(db: Db, _storeId: string): Promise<number> {
  try {
    const rows = await db.$queryRaw<Array<{ max: number | bigint | null }>>`
      SELECT MAX(
        CAST(NULLIF(regexp_replace("invoiceNumber", '[^0-9]', '', 'g'), '') AS INTEGER)
      ) AS max
      FROM "Order"
      WHERE "invoiceNumber" ILIKE 'SPL-%'
    `
    const max = asFiniteNumber(rows[0]?.max)
    if (max !== null) return max
  } catch {
    // Transaction / driver edge — fall through to bounded scan.
  }

  const recent = await db.order.findMany({
    where: {
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
 * Next SPL-#### from a never-decrementing CodeSequence row (`order:${storeId}`).
 * Call inside the same transaction as `order.create` so the row lock serializes
 * concurrent checkouts. Hard-deleting an order does not rewind this counter.
 */
export async function generateOrderCode(db: Db, storeId: string): Promise<string> {
  const highest = await findHighestSplNumber(db, storeId)
  const seed = BigInt(Math.max(ORDER_CODE_START, highest + 1))
  const key = orderSequenceKey(storeId)

  await db.$executeRaw`
    INSERT INTO "CodeSequence" ("key", "nextValue", "updatedAt")
    VALUES (${key}, ${seed}, NOW())
    ON CONFLICT ("key") DO NOTHING
  `

  const rows = await db.$queryRaw<{ nextValue: bigint }[]>`
    UPDATE "CodeSequence"
    SET "nextValue" = GREATEST("nextValue", ${seed}) + 1, "updatedAt" = NOW()
    WHERE "key" = ${key}
    RETURNING "nextValue"
  `
  const after = rows[0]?.nextValue
  if (after === undefined) {
    throw new Error(`Order counter ${key} is missing`)
  }
  return formatSplOrderCode(Number(after - 1n))
}

/**
 * Highest DROP-#### across funnel orders
 */
async function findHighestDropNumber(db: Db): Promise<number> {
  try {
    const rows = await db.$queryRaw<Array<{ max: number | bigint | null }>>`
      SELECT MAX(
        CAST(NULLIF(regexp_replace("invoiceNumber", '[^0-9]', '', 'g'), '') AS INTEGER)
      ) AS max
      FROM "Order"
      WHERE "invoiceNumber" ILIKE 'DROP-%'
    `
    const max = asFiniteNumber(rows[0]?.max)
    if (max !== null) return max
  } catch {
    // Transaction edge
  }
  return 1000
}

/**
 * Next DROP-#### from a dedicated CodeSequence row (`order:funnel`).
 */
export async function generateFunnelOrderCode(db: Db, prefix = 'DROP'): Promise<string> {
  const highest = await findHighestDropNumber(db)
  const seed = BigInt(Math.max(1001, highest + 1))
  const key = 'order:funnel'

  await db.$executeRaw`
    INSERT INTO "CodeSequence" ("key", "nextValue", "updatedAt")
    VALUES (${key}, ${seed}, NOW())
    ON CONFLICT ("key") DO NOTHING
  `

  const rows = await db.$queryRaw<{ nextValue: bigint }[]>`
    UPDATE "CodeSequence"
    SET "nextValue" = GREATEST("nextValue", ${seed}) + 1, "updatedAt" = NOW()
    WHERE "key" = ${key}
    RETURNING "nextValue"
  `
  const after = rows[0]?.nextValue
  if (after === undefined) {
    throw new Error(`Order counter ${key} is missing`)
  }
  return `${prefix}-${Number(after - 1n)}`
}

async function withTx(db: Db, work: (tx: Prisma.TransactionClient) => Promise<void>): Promise<void> {
  const client = db as PrismaClient
  if (typeof client.$transaction === 'function') {
    await client.$transaction(work)
    return
  }
  await work(db as Prisma.TransactionClient)
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
      try {
        await withTx(db, async (tx) => {
          const candidate = await generateOrderCode(tx, storeId)
          await tx.order.update({
            where: { id: row.id },
            data: { invoiceNumber: candidate },
          })
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
