/**
 * Remove demo/seed catalog from the live database (Unsplash products, SPL-1001, seed POs, etc.).
 * Run: pnpm db:purge-demo
 */
import { PrismaClient } from '@prisma/client'
import { purgeDemoCatalogCore } from '../src/modules/catalog/purge-demo-catalog.core'

const prisma = new PrismaClient()

async function resolveStoreId(): Promise<string> {
  const candidates = [
    process.env['NEXT_PUBLIC_STORE_ID'],
    process.env['DEFAULT_STORE_SLUG'],
    'splaro',
  ].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i) as string[]

  for (const candidate of candidates) {
    const store = await prisma.store.findFirst({
      where: { OR: [{ id: candidate }, { slug: candidate }] },
      select: { id: true },
    })
    if (store) return store.id
  }

  throw new Error(`Store not found (${candidates.join(' → ')})`)
}

async function main() {
  const storeId = await resolveStoreId()
  const result = await purgeDemoCatalogCore(prisma, storeId)

  console.log(`Demo products found: ${result.demoProductsFound}`)
  console.log(`Removed ${result.demoOrdersRemoved} demo order(s)`)
  console.log(`Removed ${result.ordersTiedToDemoRemoved} order(s) tied to demo products`)
  console.log(`Removed ${result.demoProductsRemoved} demo product(s)`)

  if (result.demoProductsSkipped > 0) {
    console.warn(`${result.demoProductsSkipped} demo product(s) could not be removed`)
  }

  if (result.purchaseOrdersRemoved) {
    console.log(`Removed ${result.purchaseOrdersRemoved} seed purchase order(s)`)
  }
  if (result.fabricRowsRemoved) {
    console.log(`Removed ${result.fabricRowsRemoved} seed fabric row(s)`)
  }
  if (result.productionBatchesRemoved) {
    console.log(`Removed ${result.productionBatchesRemoved} seed production batch(es)`)
  }
  if (result.suppliersRemoved) {
    console.log(`Removed ${result.suppliersRemoved} seed supplier(s)`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
