import type { Prisma } from '@prisma/client'

/** Buyer-facing enquiry handle: WS-000001, WS-000002, … */
export const WHOLESALE_REFERENCE_PREFIX = 'WS'
export const WHOLESALE_REFERENCE_PAD = 6
const SEQUENCE_KEY = 'wholesale-reference'

const REFERENCE_RE = /^WS-(\d{4,})$/i

export function formatWholesaleReference(value: bigint | number): string {
  return `${WHOLESALE_REFERENCE_PREFIX}-${String(value).padStart(WHOLESALE_REFERENCE_PAD, '0')}`
}

export function isWholesaleReference(value: string | null | undefined): boolean {
  return REFERENCE_RE.test(value?.trim() ?? '')
}

/**
 * Reserve the next reference inside the caller's transaction.
 *
 * Same mechanism as the barcode allocator: one counter row advanced by a single
 * `UPDATE ... RETURNING`, which holds a row lock for the rest of the
 * transaction. Two buyers submitting at the same moment therefore serialise on
 * that row and get different numbers, where `MAX(referenceCode) + 1` would hand
 * both the same one.
 *
 * The INSERT is a safety net for a database restored without the migration's
 * seed row; ON CONFLICT DO NOTHING means it can never reset a live counter.
 */
export async function reserveWholesaleReference(
  tx: Prisma.TransactionClient,
): Promise<string> {
  await tx.$executeRaw`
    INSERT INTO "CodeSequence" ("key", "nextValue", "updatedAt")
    VALUES (${SEQUENCE_KEY}, 1, NOW())
    ON CONFLICT ("key") DO NOTHING
  `

  const rows = await tx.$queryRaw<{ nextValue: bigint }[]>`
    UPDATE "CodeSequence"
    SET "nextValue" = "nextValue" + 1, "updatedAt" = NOW()
    WHERE "key" = ${SEQUENCE_KEY}
    RETURNING "nextValue"
  `

  const after = rows[0]?.nextValue
  if (after === undefined) {
    throw new Error('Wholesale reference counter row is missing')
  }

  // `after` is the value following this reservation, so ours is one back.
  return formatWholesaleReference(after - 1n)
}
