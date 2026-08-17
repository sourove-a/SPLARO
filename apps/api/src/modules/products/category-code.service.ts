import { Injectable, InternalServerErrorException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { categoryCodeBlock, isValidCategoryCode, nextCategoryCode } from '@splaro/config'

/**
 * Allocates the permanent Category Code.
 *
 * The ledger (`IssuedCategoryCode`) is the authority, not the Category row: a
 * deleted category keeps its number reserved, because variant SKUs issued under
 * it still sit in orders, on labels and in the warehouse. Handing 410 to an
 * unrelated category two years later would make those SKUs read as the wrong
 * department.
 *
 * Concurrency is settled by the primary key — the insert either creates the row
 * or returns zero, and the loser recomputes against the updated ledger.
 */

const MAX_ATTEMPTS = 25

async function issuedCodes(
  tx: Prisma.TransactionClient,
  storeId: string,
): Promise<Set<string>> {
  const rows = await tx.$queryRaw<{ code: string }[]>`
    SELECT "code" FROM "IssuedCategoryCode" WHERE "storeId" = ${storeId}
  `
  return new Set(rows.map((row) => row.code))
}

export async function issueCategoryCode(
  tx: Prisma.TransactionClient,
  input: {
    storeId: string
    categoryId?: string | null
    /** The category's own name and slug. */
    labels: (string | null | undefined)[]
    /** Its department (root/parent) labels — these decide the block. */
    department?: (string | null | undefined)[]
  },
): Promise<string> {
  const block = categoryCodeBlock(input.labels, input.department ?? [])

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const taken = await issuedCodes(tx, input.storeId)
    // Step past one more free code per retry so concurrent allocators fan out
    // instead of colliding on the same number again.
    const candidate = nextCategoryCode(block, taken, attempt - 1)
    if (!candidate) {
      throw new InternalServerErrorException(
        `No Category Code left in the ${block.department} block or the fallback block`,
      )
    }

    const label = input.labels.filter(Boolean).join(' ').slice(0, 120) || null
    const inserted = await tx.$executeRaw`
      INSERT INTO "IssuedCategoryCode" ("code", "storeId", "categoryId", "label", "issuedAt")
      VALUES (${candidate}, ${input.storeId}, ${input.categoryId ?? null}, ${label}, NOW())
      ON CONFLICT ("code") DO NOTHING
    `
    if (inserted === 1) return candidate
  }

  throw new InternalServerErrorException('Could not allocate a Category Code')
}

/**
 * Code for an existing category, allocating one only if it has none.
 * Idempotent — this is what makes the backfill safe to re-run and what keeps a
 * rename from ever producing a second number.
 */
export async function ensureCategoryCode(
  tx: Prisma.TransactionClient,
  categoryId: string,
): Promise<{ code: string; issued: boolean }> {
  const category = await tx.category.findUnique({
    where: { id: categoryId },
    select: {
      code: true,
      name: true,
      slug: true,
      storeId: true,
      parent: { select: { name: true, slug: true } },
    },
  })
  if (!category) throw new InternalServerErrorException('Category not found')
  if (isValidCategoryCode(category.code)) {
    return { code: category.code as string, issued: false }
  }

  const code = await issueCategoryCode(tx, {
    storeId: category.storeId,
    categoryId,
    labels: [category.name, category.slug],
    department: [category.parent?.name, category.parent?.slug],
  })
  await tx.category.update({ where: { id: categoryId }, data: { code } })
  return { code, issued: true }
}

@Injectable()
export class CategoryCodeService {
  issue(
    tx: Prisma.TransactionClient,
    input: { storeId: string; categoryId?: string | null; labels: (string | null | undefined)[] },
  ) {
    return issueCategoryCode(tx, input)
  }

  ensure(tx: Prisma.TransactionClient, categoryId: string) {
    return ensureCategoryCode(tx, categoryId)
  }
}
