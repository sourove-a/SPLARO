/**
 * Read-only audit of SPLARO's product identifiers.
 *
 *   pnpm db:report-product-identity
 *
 * Classifies what is on disk before anything is migrated, per the locked plan:
 *
 *   A  valid       already on the current scheme
 *   B  legacy      an older scheme, still perfectly usable — left alone
 *   C  missing     no identifier at all — safe to backfill
 *   D  broken      duplicate or malformed — needs a human decision
 *
 * Writes nothing. Class D is deliberately not auto-repaired: a duplicate SKU
 * may already be printed on two different labels, and picking a winner is a
 * merchandising decision, not a script's.
 */
import { PrismaClient } from '@prisma/client'
import {
  isValidCategoryCode,
  isValidProductCode,
  isValidVariantIdentityBarcode,
  parseVariantIdentitySku,
} from '@splaro/config'

const prisma = new PrismaClient()

function bucket(label: string, rows: string[], limit = 8) {
  console.log(`  ${label.padEnd(34)} ${rows.length}`)
  for (const row of rows.slice(0, limit)) console.log(`      ${row}`)
  if (rows.length > limit) console.log(`      … ${rows.length - limit} more`)
}

async function main() {
  const [products, variants, categories] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true,
        slug: true,
        productCode: true,
        sku: true,
        skuCategoryCode: true,
        skuModelNumber: true,
        status: true,
      },
    }),
    prisma.productVariant.findMany({
      select: {
        id: true,
        sku: true,
        barcode: true,
        colorSerial: true,
        product: { select: { slug: true, productCode: true } },
      },
    }),
    prisma.category.findMany({ select: { id: true, name: true, code: true } }),
  ])

  console.log(`\n═══ Products (${products.length}) ═══`)
  bucket(
    'A valid — six-digit code',
    products.filter((p) => isValidProductCode(p.productCode)).map((p) => p.slug),
    3,
  )
  bucket(
    'C missing — needs backfill',
    products.filter((p) => !p.productCode).map((p) => p.slug),
  )
  bucket(
    'D broken — malformed code',
    products
      .filter((p) => p.productCode && !isValidProductCode(p.productCode))
      .map((p) => `${p.slug} -> ${JSON.stringify(p.productCode)}`),
  )

  const dupCodes = new Map<string, string[]>()
  for (const p of products) {
    if (!p.productCode) continue
    dupCodes.set(p.productCode, [...(dupCodes.get(p.productCode) ?? []), p.slug])
  }
  bucket(
    'D broken — duplicate code',
    [...dupCodes.entries()].filter(([, s]) => s.length > 1).map(([c, s]) => `${c}: ${s.join(', ')}`),
  )

  console.log(`\n═══ Product SKU identity (${products.length}) ═══`)
  bucket(
    'A valid — numeric category code',
    products.filter((p) => isValidCategoryCode(p.skuCategoryCode)).map((p) => p.slug),
    3,
  )
  bucket(
    'B legacy — SPL letter code, left as is',
    products
      .filter((p) => p.skuCategoryCode && !isValidCategoryCode(p.skuCategoryCode))
      .map((p) => `${p.slug} (${p.skuCategoryCode}-${p.skuModelNumber})`),
  )
  bucket('C missing — no identity yet', products.filter((p) => !p.skuCategoryCode).map((p) => p.slug))

  console.log(`\n═══ Variants (${variants.length}) ═══`)
  const parsed = variants.filter((v) => parseVariantIdentitySku(v.sku))
  bucket('A valid — CC-SSSS-OO-SIZE', parsed.map((v) => v.sku ?? ''), 3)
  bucket(
    'B legacy — older SKU, left as is',
    variants.filter((v) => v.sku && !parseVariantIdentitySku(v.sku)).map((v) => v.sku ?? ''),
    5,
  )
  bucket('C missing — no SKU', variants.filter((v) => !v.sku?.trim()).map((v) => v.id))
  bucket(
    'C missing — colour serial on new scheme',
    parsed.filter((v) => v.colorSerial == null).map((v) => v.sku ?? ''),
  )

  const dupSku = new Map<string, string[]>()
  const dupBarcode = new Map<string, string[]>()
  for (const v of variants) {
    if (v.sku) dupSku.set(v.sku, [...(dupSku.get(v.sku) ?? []), v.id])
    if (v.barcode) dupBarcode.set(v.barcode, [...(dupBarcode.get(v.barcode) ?? []), v.id])
  }
  bucket(
    'D broken — duplicate SKU',
    [...dupSku.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => `${k} (${v.length})`),
  )
  bucket(
    'D broken — duplicate barcode',
    [...dupBarcode.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => `${k} (${v.length})`),
  )
  bucket(
    'B legacy — non-EAN13 barcode, left as is',
    variants
      .filter((v) => v.barcode && !isValidVariantIdentityBarcode(v.barcode))
      .map((v) => v.barcode ?? ''),
    5,
  )

  console.log(`\n═══ Categories (${categories.length}) ═══`)
  bucket('A valid — three-digit code', categories.filter((c) => isValidCategoryCode(c.code)).map((c) => `${c.code} ${c.name}`), 3)
  bucket('C missing — needs backfill', categories.filter((c) => !c.code).map((c) => c.name))
  bucket(
    'D broken — malformed code',
    categories.filter((c) => c.code && !isValidCategoryCode(c.code)).map((c) => `${c.name} -> ${c.code}`),
  )
  console.log('')
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
