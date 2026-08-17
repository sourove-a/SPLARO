/**
 * SPLARO Category Code — the permanent numeric identity of a merchandise
 * category, and the first segment of every variant SKU.
 *
 *   410-0123-01-42
 *   └┬┘
 *    └ Category Code (410 = Footwear block)
 *
 * Three digits, not two. The catalogue already carries 86 categories across six
 * departments, so a 10–99 namespace would have been exhausted immediately; a
 * two-digit scheme would have forced a renumbering later, and a Category Code
 * cannot be renumbered once SKUs are printed on labels and sitting in orders.
 *
 * Codes are allocated inside per-department blocks so the number stays readable
 * to a human in the warehouse — 1xx is womenswear, 4xx is footwear — while the
 * allocator only ever hands out the next free number in the block. A category
 * that does not match a known department falls into the 9xx block.
 */

export const CATEGORY_CODE_LENGTH = 3

export interface CategoryCodeBlock {
  /** Block name, matched against the department/root category. */
  department: string
  /** First code in the block, inclusive. */
  start: number
  /** Last code in the block, inclusive. */
  end: number
  /** Words that put a category in this block, matched against name + slug + parent. */
  match: string[]
}

/**
 * Blocks are frozen. Widening a block later is safe; moving one is not, because
 * codes already issued inside it keep their number.
 */
export const CATEGORY_CODE_BLOCKS: CategoryCodeBlock[] = [
  {
    department: 'Women',
    start: 100,
    end: 199,
    match: ['women', 'woman', 'ladies', 'saree', 'abaya', 'kaftan', 'kurti', 'dress', 'hijab'],
  },
  {
    department: 'Men',
    start: 200,
    end: 299,
    match: ['men', 'man', 'panjabi', 'punjabi', 'shirt', 'polo', 'trouser', 'pant'],
  },
  { department: 'Kids', start: 300, end: 399, match: ['kid', 'child', 'boy', 'girl', 'baby', 'toddler'] },
  {
    department: 'Footwear',
    start: 400,
    end: 499,
    match: ['footwear', 'shoe', 'sneaker', 'loafer', 'sandal', 'slipper', 'boot', 'heel'],
  },
  {
    department: 'Accessories',
    start: 500,
    end: 599,
    match: ['accessor', 'bag', 'wallet', 'watch', 'jewel', 'cap', 'belt', 'perfume', 'fragrance', 'glass'],
  },
  { department: 'Home', start: 600, end: 699, match: ['home', 'decor', 'mat', 'cushion', 'bedding'] },
  { department: 'General', start: 900, end: 999, match: [] },
]

export const CATEGORY_CODE_FALLBACK_BLOCK = CATEGORY_CODE_BLOCKS[
  CATEGORY_CODE_BLOCKS.length - 1
] as CategoryCodeBlock

const CATEGORY_CODE_RE = /^[0-9]{3}$/

export function isValidCategoryCode(value: string | null | undefined): boolean {
  const raw = value?.trim()
  return Boolean(raw && CATEGORY_CODE_RE.test(raw))
}

function normalizeLabels(labels: (string | null | undefined)[]): string {
  return labels
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
}

function matchBlock(haystack: string): CategoryCodeBlock | null {
  for (const block of CATEGORY_CODE_BLOCKS) {
    if (block.match.some((word) => haystack.includes(word))) return block
  }
  return null
}

/**
 * Which block a category belongs to.
 *
 * The department decides first and the category's own name only breaks a tie.
 * Read the other way round, "Girls Wear / Pant Tops" matches `pant` and lands
 * in menswear — the child name describes the garment, the parent describes who
 * wears it, and the block is about the latter.
 *
 * `department` is the root/parent labels; `own` is the category's own name and
 * slug. Callers that have only a flat list can pass it as `own`.
 */
export function categoryCodeBlock(
  labels: (string | null | undefined)[],
  department: (string | null | undefined)[] = [],
): CategoryCodeBlock {
  return (
    matchBlock(normalizeLabels(department)) ??
    matchBlock(normalizeLabels(labels)) ??
    CATEGORY_CODE_FALLBACK_BLOCK
  )
}

/**
 * Lowest free code in the block, or in the fallback block once it is full.
 * `taken` is every code the store has ever issued — the caller reads it from
 * the ledger, so a deleted category's number is still counted as used.
 *
 * `skip` steps past that many free codes. Callers pass their retry count, so
 * two allocators racing for 401 do not both come back for it on the next pass:
 * the second takes 402. At zero contention this is exactly "lowest free code".
 */
export function nextCategoryCode(
  block: CategoryCodeBlock,
  taken: ReadonlySet<string>,
  skip = 0,
): string | null {
  let remaining = skip
  for (const candidate of [block, CATEGORY_CODE_FALLBACK_BLOCK]) {
    for (let value = candidate.start; value <= candidate.end; value++) {
      const code = String(value)
      if (taken.has(code)) continue
      if (remaining > 0) {
        remaining -= 1
        continue
      }
      return code
    }
  }
  return null
}
