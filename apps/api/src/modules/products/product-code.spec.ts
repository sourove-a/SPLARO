import {
  buildVariantIdentityBarcode,
  buildVariantIdentitySku,
  canonicalSizeToken,
  ean13CheckDigit,
  isValidProductCode,
  isValidVariantIdentityBarcode,
  normalizeProductCode,
  PRODUCT_CODE_MAX,
  PRODUCT_CODE_MIN,
  randomProductCode,
  sizeOrdinal,
} from '@splaro/config'
import { issueProductCode } from './product-code.service'

/**
 * Minimal stand-in for the ledger table: `INSERT … ON CONFLICT DO NOTHING`
 * returns 1 when it created a row and 0 when the code was taken, which is the
 * only behaviour issueProductCode depends on.
 */
function fakeLedger(taken: Set<string> = new Set()) {
  const inserted: string[] = []
  return {
    taken,
    inserted,
    tx: {
      $executeRaw: (_strings: TemplateStringsArray, ...values: unknown[]) => {
        const code = String(values[0])
        if (taken.has(code)) return Promise.resolve(0)
        taken.add(code)
        inserted.push(code)
        return Promise.resolve(1)
      },
    },
  }
}

describe('Product Code format', () => {
  it('is exactly six digits', () => {
    for (let i = 0; i < 500; i++) {
      const code = randomProductCode()
      expect(code).toMatch(/^[0-9]{6}$/)
      expect(Number(code)).toBeGreaterThanOrEqual(PRODUCT_CODE_MIN)
      expect(Number(code)).toBeLessThanOrEqual(PRODUCT_CODE_MAX)
    }
  })

  it('never produces a leading-zero or obviously sequential code', () => {
    // 000001/000002 would leak how many products exist and how new one is.
    expect(randomProductCode(() => 0)).toBe('100000')
    expect(randomProductCode(() => 0.999999999)).toBe('999999')
  })

  it('validates and normalizes operator input', () => {
    expect(isValidProductCode('284731')).toBe(true)
    expect(isValidProductCode('28473')).toBe(false)
    expect(isValidProductCode('2847311')).toBe(false)
    expect(isValidProductCode('28A731')).toBe(false)
    expect(isValidProductCode(null)).toBe(false)
    expect(normalizeProductCode('  284 731 ')).toBe('284731')
    expect(normalizeProductCode('SPL-284731')).toBe('284731')
    expect(normalizeProductCode('2847')).toBeNull()
  })
})

describe('issuing', () => {
  it('claims a code through the ledger', async () => {
    const ledger = fakeLedger()
    const code = await issueProductCode(ledger.tx as never, { storeId: 'store-1' })
    expect(isValidProductCode(code)).toBe(true)
    expect(ledger.inserted).toEqual([code])
  })

  it('retries past a collision instead of duplicating', async () => {
    // Two "concurrent" creates draw the same first number; the loser redraws.
    const ledger = fakeLedger(new Set(['100000']))
    const draws = ['100000', '424242']
    let i = 0
    const code = await issueProductCode(ledger.tx as never, {
      storeId: 'store-1',
      random: () => (Number(draws[i++]!) - PRODUCT_CODE_MIN) / (PRODUCT_CODE_MAX - PRODUCT_CODE_MIN + 1),
    })
    expect(code).toBe('424242')
  })

  it('never hands the same code to two products', async () => {
    const ledger = fakeLedger()
    const codes = new Set<string>()
    for (let i = 0; i < 300; i++) {
      codes.add(await issueProductCode(ledger.tx as never, { storeId: 'store-1' }))
    }
    expect(codes.size).toBe(300)
  })

  it('gives up rather than looping forever when the space is exhausted', async () => {
    // Ledger that refuses everything — 12 draws then a clear error.
    const tx = { $executeRaw: () => Promise.resolve(0) }
    await expect(issueProductCode(tx as never, { storeId: 'store-1' })).rejects.toThrow(
      /Could not allocate a Product Code/,
    )
  })
})

describe('variant identity codes', () => {
  const shoe = { categoryCode: '410', styleSerial: 123, colourSerial: 1 }

  it('reads as category-style-colour-size', () => {
    expect(buildVariantIdentitySku({ ...shoe, size: '42' })).toBe('410-0123-01-42')
    expect(buildVariantIdentitySku({ ...shoe, colourSerial: 2, size: 'XL' })).toBe('410-0123-02-XL')
    expect(buildVariantIdentitySku({ ...shoe, size: null })).toBe('410-0123-01-OS')
    expect(buildVariantIdentitySku({ ...shoe, styleSerial: 7, size: '  one size ' })).toBe(
      '410-0007-01-OS',
    )
  })

  it('normalizes the size token so one shelf cannot become three SKUs', () => {
    expect(canonicalSizeToken('One Size')).toBe('OS')
    expect(canonicalSizeToken('one-size')).toBe('OS')
    expect(canonicalSizeToken('Free Size')).toBe('OS')
    expect(canonicalSizeToken('2XL')).toBe('XXL')
    expect(canonicalSizeToken('xxxl')).toBe('XXXL')
    expect(canonicalSizeToken('100ml')).toBe('100ML')
  })

  it('carries the same identity in the barcode, with a valid check digit', () => {
    const barcode = buildVariantIdentityBarcode({ ...shoe, size: '42' })
    expect(barcode).toHaveLength(13)
    expect(barcode.startsWith('4100123' + '01')).toBe(true)
    expect(isValidVariantIdentityBarcode(barcode)).toBe(true)
    expect(ean13CheckDigit(barcode.slice(0, 12))).toBe(Number(barcode[12]))
  })

  it('rejects a barcode whose digits were altered', () => {
    const barcode = buildVariantIdentityBarcode({ ...shoe, size: '42' })
    const tampered = `${barcode.slice(0, 5)}${(Number(barcode[5]) + 1) % 10}${barcode.slice(6)}`
    expect(isValidVariantIdentityBarcode(tampered)).toBe(false)
  })

  it('gives every size in a run its own barcode', () => {
    const sizes = ['OS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '38', '39', '40', '41.5', '42']
    const codes = new Set(sizes.map((size) => buildVariantIdentityBarcode({ ...shoe, size })))
    expect(codes.size).toBe(sizes.length)
  })

  it('separates colours, styles and categories of the same size', () => {
    const base = buildVariantIdentityBarcode({ ...shoe, size: '42' })
    expect(buildVariantIdentityBarcode({ ...shoe, colourSerial: 2, size: '42' })).not.toBe(base)
    expect(buildVariantIdentityBarcode({ ...shoe, styleSerial: 124, size: '42' })).not.toBe(base)
    expect(buildVariantIdentityBarcode({ ...shoe, categoryCode: '411', size: '42' })).not.toBe(base)
  })

  it('is stable — the same inputs always give the same codes', () => {
    expect(buildVariantIdentitySku({ ...shoe, size: 'M' })).toBe(
      buildVariantIdentitySku({ ...shoe, size: 'M' }),
    )
    expect(buildVariantIdentityBarcode({ ...shoe, size: 'M' })).toBe(
      buildVariantIdentityBarcode({ ...shoe, size: 'M' }),
    )
  })

  it('keeps frozen ordinals for the lettered run', () => {
    // Changing any of these would invalidate labels already printed.
    expect(sizeOrdinal('OS')).toBe(0)
    expect(sizeOrdinal('M')).toBe(4)
    expect(sizeOrdinal('XL')).toBe(6)
    expect(sizeOrdinal('2XL')).toBe(sizeOrdinal('XXL'))
    expect(sizeOrdinal('42')).toBe(184)
    expect(sizeOrdinal('41.5')).toBe(183)
  })

  it('still produces a code for a size label nobody planned for', () => {
    const ordinal = sizeOrdinal('100ML')
    expect(ordinal).toBeGreaterThanOrEqual(800)
    expect(isValidVariantIdentityBarcode(buildVariantIdentityBarcode({ ...shoe, size: '100ML' }))).toBe(
      true,
    )
  })
})
