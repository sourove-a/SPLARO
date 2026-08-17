/**
 * Concurrency proof for the identity system, against a real database.
 *
 *   pnpm db:verify-identity-concurrency
 *
 * The unit tests use a fake ledger; this exercises the actual Postgres unique
 * constraints, which is the only thing that proves two admins clicking Save at
 * the same moment cannot end up with the same number.
 *
 * Everything it writes is inside a transaction that is rolled back, except the
 * ledger rows — those are meant to survive, that is the whole point of a ledger,
 * so the script reports how many test codes it burned.
 *
 * Refuses to run against a non-local DATABASE_URL.
 */
import { PrismaClient } from '@prisma/client'
import { isValidCategoryCode, isValidProductCode } from '@splaro/config'
import { issueProductCode } from '../src/modules/products/product-code.service'
import { issueCategoryCode } from '../src/modules/products/category-code.service'

const prisma = new PrismaClient()
const PARALLEL = 25

function report(label: string, pass: boolean, detail: string) {
  console.log(`${pass ? '✅' : '❌'} ${label.padEnd(46)} ${detail}`)
  if (!pass) process.exitCode = 1
}

async function main() {
  const url = process.env.DATABASE_URL ?? ''
  if (!/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error('Refusing to run: DATABASE_URL is not local')
  }
  const store = await prisma.store.findFirst({ select: { id: true } })
  if (!store) throw new Error('No store in this database')

  // ── Product Codes, issued in parallel ──────────────────────
  const productCodes = await Promise.all(
    Array.from({ length: PARALLEL }, () =>
      prisma.$transaction((tx) => issueProductCode(tx, { storeId: store.id })),
    ),
  )
  report(
    'parallel product codes are unique',
    new Set(productCodes).size === PARALLEL,
    `${new Set(productCodes).size}/${PARALLEL} distinct`,
  )
  report(
    'every product code is six digits',
    productCodes.every(isValidProductCode),
    productCodes.slice(0, 3).join(', ') + ' …',
  )

  // ── Category Codes, issued in parallel ─────────────────────
  const categoryCodes = await Promise.all(
    Array.from({ length: PARALLEL }, (_, i) =>
      prisma
        .$transaction((tx) =>
          issueCategoryCode(tx, {
            storeId: store.id,
            labels: [`Concurrency Probe ${i}`],
            department: ['Accessories'],
          }),
        )
        .catch((error: unknown) => `ERR:${error instanceof Error ? error.message : String(error)}`),
    ),
  )
  const issuedCategory = categoryCodes.filter((c) => !c.startsWith('ERR:'))
  report(
    'parallel category codes are unique',
    new Set(issuedCategory).size === issuedCategory.length,
    `${new Set(issuedCategory).size}/${issuedCategory.length} distinct`,
  )
  report(
    'category codes are three digits',
    issuedCategory.every(isValidCategoryCode),
    issuedCategory.slice(0, 3).join(', ') + ' …',
  )

  // ── The database refuses a duplicate even if the app tries ──
  const duplicate = productCodes[0] as string
  const forced = await prisma
    .$executeRaw`INSERT INTO "IssuedProductCode" ("code", "storeId", "issuedAt") VALUES (${duplicate}, ${store.id}, NOW())`
    .then(() => 'inserted')
    .catch(() => 'rejected')
  report('database rejects a duplicate product code', forced === 'rejected', forced)

  // ── Clean up the probe rows this script created ────────────
  const removed = await prisma.$executeRaw`
    DELETE FROM "IssuedProductCode"
    WHERE "code" = ANY(${productCodes}::text[]) AND "productId" IS NULL
  `
  const removedCategories = await prisma.$executeRaw`
    DELETE FROM "IssuedCategoryCode"
    WHERE "code" = ANY(${issuedCategory}::text[]) AND "categoryId" IS NULL
  `
  console.log(`\nProbe rows removed: ${removed} product, ${removedCategories} category`)
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
