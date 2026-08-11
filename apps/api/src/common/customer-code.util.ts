import {
  CUSTOMER_CODE_START,
  formatSplCustomerCode,
  isSplCustomerCode,
  needsCustomerCodeBackfill,
  parseSplCustomerNumber,
} from '@splaro/config'
import type { Customer, Prisma, PrismaClient } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

function isUniqueViolation(error: unknown, field?: string): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false
  if ((error as { code: string }).code !== 'P2002') return false
  if (!field) return true
  const target = (error as { meta?: { target?: string[] | string } }).meta?.target
  if (Array.isArray(target)) return target.includes(field)
  if (typeof target === 'string') return target.includes(field)
  return false
}

async function findHighestSplCustomerNumber(db: Db, storeId: string): Promise<number> {
  try {
    const rows = await db.$queryRaw<Array<{ max: number | null }>>`
      SELECT MAX(
        CAST(NULLIF(regexp_replace("customerCode", '[^0-9]', '', 'g'), '') AS INTEGER)
      ) AS max
      FROM "Customer"
      WHERE "storeId" = ${storeId}
        AND "customerCode" ILIKE 'SPL-C-%'
    `
    const max = rows[0]?.max
    if (typeof max === 'number' && Number.isFinite(max)) return max
  } catch {
    // Transaction / driver edge — fall through to bounded scan.
  }

  const recent = await db.customer.findMany({
    where: {
      storeId,
      customerCode: { startsWith: 'SPL-C-', mode: 'insensitive' },
    },
    select: { customerCode: true },
    orderBy: { createdAt: 'desc' },
    take: 64,
  })

  let max = CUSTOMER_CODE_START - 1
  for (const row of recent) {
    const code = row.customerCode
    if (!code) continue
    const n = parseSplCustomerNumber(code)
    if (n !== null && n > max) max = n
  }
  return max
}

/** Next SPL-C-###### candidate. Uniqueness via storeId+customerCode + caller retry. */
export async function generateCustomerCode(db: Db, storeId: string): Promise<string> {
  const next = Math.max(CUSTOMER_CODE_START, (await findHighestSplCustomerNumber(db, storeId)) + 1)
  return formatSplCustomerCode(next)
}

export function buildCustomerLookupWhere(
  idOrCode: string,
  storeId: string,
): Prisma.CustomerWhereInput {
  const raw = idOrCode.trim()
  if (isSplCustomerCode(raw)) {
    return { storeId, customerCode: { equals: raw, mode: 'insensitive' } }
  }
  return { storeId, id: raw }
}

type CustomerCreateData = Omit<Prisma.CustomerUncheckedCreateInput, 'customerCode'>

/** Create a customer row with the next SPL-C-###### for the store. */
export async function createCustomerWithCode(db: Db, data: CustomerCreateData): Promise<Customer> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const customerCode = await generateCustomerCode(db, data.storeId)
    try {
      return await db.customer.create({ data: { ...data, customerCode } })
    } catch (error) {
      if (
        isUniqueViolation(error, 'customerCode') ||
        isUniqueViolation(error, 'storeId_customerCode')
      ) {
        continue
      }
      throw error
    }
  }
  throw new Error('Could not assign customer code')
}

/** Assign SPL-C-###### to legacy customers that still lack a public code. */
export async function backfillCustomerCodes(
  db: Db,
  storeId: string,
  limit = 50,
): Promise<number> {
  const rows = await db.customer.findMany({
    where: { storeId, OR: [{ customerCode: null }, { customerCode: '' }] },
    select: { id: true, customerCode: true },
    orderBy: { createdAt: 'asc' },
    take: Math.max(limit * 2, 100),
  })

  let fixed = 0
  for (const row of rows) {
    if (fixed >= limit) break
    if (!needsCustomerCodeBackfill(row.customerCode)) continue

    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = await generateCustomerCode(db, storeId)
      try {
        await db.customer.update({
          where: { id: row.id },
          data: { customerCode: candidate },
        })
        fixed++
        break
      } catch (error) {
        if (
          isUniqueViolation(error, 'customerCode') ||
          isUniqueViolation(error, 'storeId_customerCode')
        ) {
          continue
        }
        throw error
      }
    }
  }

  return fixed
}

export { isSplCustomerCode, needsCustomerCodeBackfill }
