import { Injectable, InternalServerErrorException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { isValidProductCode, randomProductCode } from '@splaro/config'

/**
 * Issues the permanent six-digit Product Code.
 *
 * Two products created at the same instant can draw the same random number, so
 * the decision is made by the database: the candidate is inserted into
 * `IssuedProductCode` (primary key = the code) and only an insert that actually
 * created a row wins. The loser simply draws again. An application-level
 * "SELECT then INSERT" would let both through.
 *
 * The ledger is also why a code is never recycled — it keeps the number after
 * the product row is gone.
 */

/** Draws before giving up. 900k-wide space: 12 misses in a row is not a real store. */
const MAX_ATTEMPTS = 12

export async function issueProductCode(
  tx: Prisma.TransactionClient,
  input: { storeId: string; productId?: string | null; random?: () => number },
): Promise<string> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const candidate = randomProductCode(input.random)

    // ON CONFLICT DO NOTHING returns 0 rows when the code is already issued —
    // that is the whole concurrency guard.
    const inserted = await tx.$executeRaw`
      INSERT INTO "IssuedProductCode" ("code", "storeId", "productId", "issuedAt")
      VALUES (${candidate}, ${input.storeId}, ${input.productId ?? null}, NOW())
      ON CONFLICT ("code") DO NOTHING
    `
    if (inserted === 1) return candidate
  }

  throw new InternalServerErrorException(
    'Could not allocate a Product Code — too many collisions in a row',
  )
}

/** Point an already-issued code at the product row once it exists. */
export async function linkProductCode(
  tx: Prisma.TransactionClient,
  code: string,
  productId: string,
): Promise<void> {
  await tx.$executeRaw`
    UPDATE "IssuedProductCode" SET "productId" = ${productId} WHERE "code" = ${code}
  `
}

/**
 * Product Code for an existing product, issuing one only if it has none.
 * Idempotent: a product that already carries a valid code is returned as-is,
 * which is what makes the backfill safe to re-run.
 */
export async function ensureProductCode(
  tx: Prisma.TransactionClient,
  input: { productId: string; storeId: string },
): Promise<{ code: string; issued: boolean }> {
  const product = await tx.product.findUnique({
    where: { id: input.productId },
    select: { productCode: true, storeId: true },
  })
  if (!product) throw new InternalServerErrorException('Product not found')
  if (isValidProductCode(product.productCode)) {
    return { code: product.productCode as string, issued: false }
  }

  const code = await issueProductCode(tx, {
    storeId: product.storeId,
    productId: input.productId,
  })
  await tx.product.update({ where: { id: input.productId }, data: { productCode: code } })
  return { code, issued: true }
}

@Injectable()
export class ProductCodeService {
  issue(tx: Prisma.TransactionClient, input: { storeId: string; productId?: string | null }) {
    return issueProductCode(tx, input)
  }

  link(tx: Prisma.TransactionClient, code: string, productId: string) {
    return linkProductCode(tx, code, productId)
  }

  ensure(tx: Prisma.TransactionClient, input: { productId: string; storeId: string }) {
    return ensureProductCode(tx, input)
  }
}
