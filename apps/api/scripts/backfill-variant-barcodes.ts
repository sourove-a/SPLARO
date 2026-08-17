/**
 * Give every existing variant an internal barcode.
 *
 *   pnpm db:backfill-variant-barcodes            # report only, writes nothing
 *   pnpm db:backfill-variant-barcodes -- --apply # mint the missing barcodes
 *
 * Variants created before the identity scheme can be sitting without one, which
 * means the item cannot be found by scanning it and no label can be printed for
 * it. Everything else about the row — SKU, size, colour, price — is left alone.
 *
 * Safe to re-run: a variant that already has a barcode is skipped, so a second
 * pass mints nothing. Numbers come from `reserveBarcodes`, the same counter the
 * admin panel and the CSV importer draw from, so a backfill running while the
 * shop is live cannot hand out a number a concurrent save is also using.
 *
 * Note this only mints the *counter* form. A variant on the numeric identity
 * scheme derives its barcode from category + model + colour + size, so one of
 * those missing a barcode means its identity is incomplete — those are reported
 * separately rather than papered over with a counter value that would not match
 * the label its siblings carry.
 */
import { PrismaClient } from '@prisma/client'
import { reserveBarcodes } from '../src/modules/products/barcode-sequence.service'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
/** One variant per transaction: a failure halfway leaves earlier codes minted. */
const LOG_EVERY = 25

type Row = {
  id: string
  sku: string | null
  size: string | null
  colorName: string | null
  product: { name: string; skuCategoryCode: string | null; skuModelNumber: number | null }
}

/** A product is on the numeric scheme when it carries a numeric category identity. */
function isNumericIdentity(row: Row): boolean {
  const code = row.product.skuCategoryCode
  return Boolean(code && /^\d+$/.test(code) && row.product.skuModelNumber != null)
}

function label(row: Row): string {
  const bits = [row.colorName, row.size].filter(Boolean).join(' · ')
  return `${row.product.name.slice(0, 28)}${bits ? ` (${bits})` : ''}`
}

async function main() {
  const total = await prisma.productVariant.count()
  const missing = (await prisma.productVariant.findMany({
    where: { OR: [{ barcode: null }, { barcode: '' }] },
    select: {
      id: true,
      sku: true,
      size: true,
      colorName: true,
      product: { select: { name: true, skuCategoryCode: true, skuModelNumber: true } },
    },
    orderBy: { createdAt: 'asc' },
  })) as Row[]

  const numeric = missing.filter(isNumericIdentity)
  const legacy = missing.filter((row) => !isNumericIdentity(row))

  console.log(`Variants:              ${total}`)
  console.log(`Already barcoded:      ${total - missing.length}`)
  console.log(`Missing a barcode:     ${missing.length}`)
  console.log(`  counter-issuable:    ${legacy.length}`)
  console.log(`  numeric identity:    ${numeric.length}${numeric.length ? '  (reported only — see below)' : ''}`)

  for (const row of legacy.slice(0, 20)) {
    console.log(`  mint  ${label(row)}  sku=${row.sku ?? '—'}`)
  }

  if (numeric.length > 0) {
    console.log(
      '\nThese are on the numeric scheme, where the barcode is derived from the ' +
        'product identity rather than a counter. A counter value here would not ' +
        'match the labels their sibling variants already carry, so they are left ' +
        'for a re-save of the product instead:',
    )
    for (const row of numeric.slice(0, 20)) {
      console.log(`  skip  ${label(row)}  sku=${row.sku ?? '—'}`)
    }
  }

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply to mint barcodes.')
    return
  }
  if (legacy.length === 0) {
    console.log('\nNothing to mint.')
    return
  }

  let minted = 0
  for (const [index, row] of legacy.entries()) {
    await prisma.$transaction(async (tx) => {
      // Re-read inside the transaction: a concurrent save may have given this
      // variant a barcode between the scan above and this write.
      const current = await tx.productVariant.findUnique({
        where: { id: row.id },
        select: { barcode: true },
      })
      if (current?.barcode?.trim()) return

      const [barcode] = await reserveBarcodes(tx, 1)
      if (!barcode) throw new Error(`Barcode counter returned nothing for ${row.id}`)
      await tx.productVariant.update({ where: { id: row.id }, data: { barcode } })
      minted += 1
    })
    if ((index + 1) % LOG_EVERY === 0 || index === legacy.length - 1) {
      console.log(`  ${index + 1}/${legacy.length} … ${label(row)}`)
    }
  }

  const remaining = await prisma.productVariant.count({
    where: { OR: [{ barcode: null }, { barcode: '' }] },
  })
  console.log(`\nMinted:                ${minted}`)
  console.log(`Still without barcode: ${remaining}${remaining ? ' (numeric-identity variants)' : ''}`)
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
