/**
 * Give every existing product a permanent six-digit Product Code.
 *
 *   pnpm db:backfill-product-codes            # report only, writes nothing
 *   pnpm db:backfill-product-codes -- --apply # assign the missing codes
 *
 * Safe to re-run: a product that already has a valid code is skipped, so a
 * second pass assigns nothing and no code ever changes. Codes come from the
 * same ledger the API uses, so a backfill running while the shop is live cannot
 * collide with a product being created at that moment.
 *
 * Nothing else is touched — existing sku, rmCode, barcode and every variant
 * code are left exactly as they are.
 */
import { PrismaClient } from '@prisma/client'
import { isValidProductCode } from '@splaro/config'
import { ensureProductCode } from '../src/modules/products/product-code.service'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
/** One product per transaction: a failure halfway leaves earlier codes assigned. */
const BATCH_LOG_EVERY = 25

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, name: true, slug: true, storeId: true, productCode: true, status: true },
    orderBy: { createdAt: 'asc' },
  })

  const missing = products.filter((p) => !isValidProductCode(p.productCode))
  const malformed = products.filter(
    (p) => p.productCode != null && !isValidProductCode(p.productCode),
  )

  console.log(`Products:            ${products.length}`)
  console.log(`Already coded:       ${products.length - missing.length}`)
  console.log(`Missing a code:      ${missing.length}`)
  if (malformed.length) {
    console.log(`Malformed codes:     ${malformed.length} (will be reissued)`)
    for (const row of malformed.slice(0, 10)) {
      console.log(`  ${row.slug} -> ${JSON.stringify(row.productCode)}`)
    }
  }

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply to assign codes.')
    return
  }
  if (missing.length === 0) {
    console.log('\nNothing to do.')
    return
  }

  let assigned = 0
  for (const [index, product] of missing.entries()) {
    const { code, issued } = await prisma.$transaction((tx) =>
      ensureProductCode(tx, { productId: product.id, storeId: product.storeId }),
    )
    if (issued) assigned += 1
    if ((index + 1) % BATCH_LOG_EVERY === 0 || index === missing.length - 1) {
      console.log(`  ${index + 1}/${missing.length} … ${product.slug} -> ${code}`)
    }
  }

  const remaining = await prisma.product.count({ where: { productCode: null } })
  console.log(`\nAssigned:            ${assigned}`)
  console.log(`Still without code:  ${remaining}`)
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
