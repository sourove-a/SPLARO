import {
  CATEGORY_CODE_BLOCKS,
  categoryCodeBlock,
  isValidCategoryCode,
  nextCategoryCode,
} from '@splaro/config'
import { issueCategoryCode } from './category-code.service'

/** Ledger stand-in: the PK insert is the only behaviour the allocator relies on. */
function fakeLedger(taken: string[] = []) {
  const codes = new Set(taken)
  return {
    codes,
    tx: {
      $queryRaw: () => Promise.resolve([...codes].map((code) => ({ code }))),
      $executeRaw: (_s: TemplateStringsArray, ...values: unknown[]) => {
        const code = String(values[0])
        if (codes.has(code)) return Promise.resolve(0)
        codes.add(code)
        return Promise.resolve(1)
      },
    },
  }
}

describe('Category Code blocks', () => {
  it('has room for the catalogue as it stands', () => {
    // 86 categories exist today across 6 departments; a 10–99 namespace would
    // have been full on day one, which is why the codes are three digits.
    const capacity = CATEGORY_CODE_BLOCKS.reduce((sum, b) => sum + (b.end - b.start + 1), 0)
    expect(capacity).toBeGreaterThan(600)
    for (const block of CATEGORY_CODE_BLOCKS) {
      expect(String(block.start)).toHaveLength(3)
      expect(String(block.end)).toHaveLength(3)
    }
  })

  it('lets the department decide, not the garment name', () => {
    // "Girls Wear / Pant Tops" matches `pant`; the parent is what makes it kids.
    expect(categoryCodeBlock(['Pant Tops', 'pant-tops'], ['Girls Wear']).department).toBe('Kids')
    expect(categoryCodeBlock(['Shirts', 'shirts'], ['Boys Wear']).department).toBe('Kids')
    expect(categoryCodeBlock(['Shirts', 'shirts'], ['Men']).department).toBe('Men')
    expect(categoryCodeBlock(['Saree', 'sarees'], ['Women']).department).toBe('Women')
    expect(categoryCodeBlock(['Loafers', 'loafers'], ['Footwear']).department).toBe('Footwear')
  })

  it('falls back to the category itself when it has no department', () => {
    expect(categoryCodeBlock(['Sneakers', 'sneakers']).department).toBe('Footwear')
    expect(categoryCodeBlock(['Widgets', 'widgets']).department).toBe('General')
  })

  it('hands out the lowest free code in the block', () => {
    const footwear = CATEGORY_CODE_BLOCKS.find((b) => b.department === 'Footwear')!
    expect(nextCategoryCode(footwear, new Set())).toBe('400')
    expect(nextCategoryCode(footwear, new Set(['400', '401']))).toBe('402')
  })

  it('overflows into the General block rather than failing', () => {
    const footwear = CATEGORY_CODE_BLOCKS.find((b) => b.department === 'Footwear')!
    const full = new Set<string>()
    for (let v = footwear.start; v <= footwear.end; v++) full.add(String(v))
    expect(nextCategoryCode(footwear, full)).toBe('900')
  })
})

describe('Category Code issuing', () => {
  it('allocates automatically — the operator never types one', async () => {
    const ledger = fakeLedger()
    const code = await issueCategoryCode(ledger.tx as never, {
      storeId: 'store-1',
      labels: ['Hijab', 'hijab'],
      department: ['Women'],
    })
    expect(isValidCategoryCode(code)).toBe(true)
    expect(code.startsWith('1')).toBe(true)
  })

  it('never gives two categories the same code', async () => {
    const ledger = fakeLedger()
    const codes: string[] = []
    for (let i = 0; i < 40; i++) {
      codes.push(
        await issueCategoryCode(ledger.tx as never, {
          storeId: 'store-1',
          labels: [`Category ${i}`],
          department: ['Men'],
        }),
      )
    }
    expect(new Set(codes).size).toBe(40)
  })

  it('does not reissue a code held by a deleted category', async () => {
    // 400 was issued once and its category later deleted; the ledger keeps it.
    const ledger = fakeLedger(['400'])
    const code = await issueCategoryCode(ledger.tx as never, {
      storeId: 'store-1',
      labels: ['Sneakers'],
      department: ['Footwear'],
    })
    expect(code).toBe('401')
  })
})
