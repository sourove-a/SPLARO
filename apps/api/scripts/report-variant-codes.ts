/**
 * Read-only report of variant SKU / barcode hygiene.
 *
 * Existing merchant codes are never rewritten automatically — this prints what
 * a backfill *would* have to deal with (missing codes, duplicates) so the
 * decision stays with an operator.
 *
 *   pnpm db:report-variant-codes
 *   pnpm db:report-variant-codes -- --store=splaro
 */
import { PrismaClient } from '@prisma/client'
import { buildVariantSku, isValidInternalBarcode } from '@splaro/config'

const prisma = new PrismaClient()

function argValue(name: string): string | undefined {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return hit?.split('=')[1]?.trim() || undefined
}

async function main() {
  const storeArg = argValue('store')
  const store = storeArg
    ? await prisma.store.findFirst({
        where: { OR: [{ id: storeArg }, { slug: storeArg }] },
        select: { id: true, slug: true },
      })
    : await prisma.store.findFirst({ select: { id: true, slug: true } })

  if (!store) {
    console.error(`No store found${storeArg ? ` for "${storeArg}"` : ''}.`)
    process.exitCode = 1
    return
  }

  const variants = await prisma.productVariant.findMany({
    where: { product: { storeId: store.id } },
    select: {
      id: true,
      sku: true,
      barcode: true,
      size: true,
      color: true,
      colorName: true,
      product: {
        select: {
          id: true,
          name: true,
          skuCategoryCode: true,
          skuModelNumber: true,
          category: { select: { name: true, slug: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const missingSku = variants.filter((v) => !v.sku?.trim())
  const missingBarcode = variants.filter((v) => !v.barcode?.trim())
  const legacyBarcode = variants.filter(
    (v) => v.barcode?.trim() && !isValidInternalBarcode(v.barcode),
  )
  const missingIdentity = variants.filter(
    (v) => !v.product.skuCategoryCode || !v.product.skuModelNumber,
  )

  const group = (key: 'sku' | 'barcode') => {
    const map = new Map<string, string[]>()
    for (const variant of variants) {
      const value = variant[key]?.trim()
      if (!value) continue
      map.set(value, [...(map.get(value) ?? []), variant.id])
    }
    return [...map.entries()].filter(([, ids]) => ids.length > 1)
  }

  const duplicateSkus = group('sku')
  const duplicateBarcodes = group('barcode')

  console.log(`Store: ${store.slug} (${store.id})`)
  console.log(`Variants:               ${variants.length}`)
  console.log(`Missing SKU:            ${missingSku.length}`)
  console.log(`Missing barcode:        ${missingBarcode.length}`)
  console.log(`Non-internal barcode:   ${legacyBarcode.length}`)
  console.log(`Products without model: ${missingIdentity.length}`)
  console.log(`Duplicate SKUs:         ${duplicateSkus.length}`)
  console.log(`Duplicate barcodes:     ${duplicateBarcodes.length}`)

  if (duplicateSkus.length) {
    console.log('\nDuplicate SKUs (block the unique index — fix in Admin → Products):')
    for (const [sku, ids] of duplicateSkus.slice(0, 25)) {
      console.log(`  ${sku}  → ${ids.length} variants: ${ids.join(', ')}`)
    }
  }

  if (duplicateBarcodes.length) {
    console.log('\nDuplicate barcodes:')
    for (const [barcode, ids] of duplicateBarcodes.slice(0, 25)) {
      console.log(`  ${barcode}  → ${ids.length} variants: ${ids.join(', ')}`)
    }
  }

  if (missingSku.length) {
    console.log('\nVariants with no SKU (a backfill would generate these):')
    for (const variant of missingSku.slice(0, 25)) {
      const proposed = buildVariantSku({
        category:
          variant.product.skuCategoryCode ??
          [variant.product.category?.name, variant.product.category?.slug]
            .filter(Boolean)
            .join(' '),
        model: variant.product.skuModelNumber ?? 1,
        color: variant.colorName ?? variant.color,
        size: variant.size,
      })
      console.log(`  ${variant.product.name} · ${variant.id} → ${proposed}`)
    }
    if (missingSku.length > 25) console.log(`  … and ${missingSku.length - 25} more`)
  }

  console.log('\nNothing was written. This report is read-only.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => void prisma.$disconnect())
