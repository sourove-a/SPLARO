/**
 * Give every existing category its permanent Category Code.
 *
 *   pnpm db:backfill-category-codes            # report only
 *   pnpm db:backfill-category-codes -- --apply # allocate the missing codes
 *
 * Safe to re-run: a category that already holds a valid code is skipped, so a
 * second pass allocates nothing and no code moves. Codes come from the same
 * ledger the API uses, so running this while the shop is live cannot collide
 * with a category being created at that moment.
 *
 * Parents are processed before children so a department lands on the round
 * number at the head of its block (Footwear 400, then its children 401, 402…).
 */
import { PrismaClient } from '@prisma/client'
import { categoryCodeBlock, isValidCategoryCode } from '@splaro/config'
import { ensureCategoryCode } from '../src/modules/products/category-code.service'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

async function main() {
  const categories = await prisma.category.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      code: true,
      parentId: true,
      parent: { select: { name: true, slug: true } },
    },
    orderBy: [{ parentId: { sort: 'asc', nulls: 'first' } }, { sortOrder: 'asc' }],
  })

  const missing = categories.filter((c) => !isValidCategoryCode(c.code))

  console.log(`Categories:      ${categories.length}`)
  console.log(`Already coded:   ${categories.length - missing.length}`)
  console.log(`Missing a code:  ${missing.length}`)

  const byBlock = new Map<string, number>()
  for (const category of missing) {
    const block = categoryCodeBlock(
      [category.name, category.slug],
      [category.parent?.name, category.parent?.slug],
    )
    byBlock.set(block.department, (byBlock.get(block.department) ?? 0) + 1)
  }
  console.log('\nPlanned blocks:')
  for (const [department, count] of [...byBlock.entries()].sort()) {
    console.log(`  ${department.padEnd(12)} ${count}`)
  }

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply to allocate.')
    return
  }
  if (missing.length === 0) {
    console.log('\nNothing to do.')
    return
  }

  let allocated = 0
  for (const category of missing) {
    const { code, issued } = await prisma.$transaction((tx) => ensureCategoryCode(tx, category.id))
    if (issued) allocated += 1
    console.log(`  ${code}  ${category.parent?.name ? `${category.parent.name} / ` : ''}${category.name}`)
  }

  const remaining = await prisma.category.count({ where: { code: null } })
  console.log(`\nAllocated:       ${allocated}`)
  console.log(`Still uncoded:   ${remaining}`)
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
