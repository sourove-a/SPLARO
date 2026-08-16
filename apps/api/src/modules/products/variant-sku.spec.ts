import {
  BARCODE_START,
  buildVariantSku,
  categoryCode,
  categoryIsSizeless,
  colorCode,
  formatBarcode,
  isValidInternalBarcode,
  isValidSku,
  normalizeSku,
  sizeCode,
} from '@splaro/config'

describe('variant SKU format', () => {
  it('builds SPL-{CAT}-{MODEL}-{COLOR}-{SIZE}', () => {
    expect(buildVariantSku({ category: 'Abaya', model: 1, color: 'Black', size: 'M' })).toBe(
      'SPL-ABY-001-BLK-M',
    )
    expect(buildVariantSku({ category: 'Shirt', model: 14, color: 'White', size: 'XL' })).toBe(
      'SPL-SHR-014-WHT-XL',
    )
    expect(buildVariantSku({ category: 'Footwear', model: 21, color: 'Brown', size: '42' })).toBe(
      'SPL-SHO-021-BRN-42',
    )
  })

  it('changes only the size segment when the size changes', () => {
    const parts = { category: 'Abaya', model: 1, color: 'Black' }
    expect(buildVariantSku({ ...parts, size: 'M' })).toBe('SPL-ABY-001-BLK-M')
    expect(buildVariantSku({ ...parts, size: 'L' })).toBe('SPL-ABY-001-BLK-L')
  })

  it('changes only the colour segment when the colour changes', () => {
    const parts = { category: 'Abaya', model: 1, size: 'L' }
    expect(buildVariantSku({ ...parts, color: 'Black' })).toBe('SPL-ABY-001-BLK-L')
    expect(buildVariantSku({ ...parts, color: 'Beige' })).toBe('SPL-ABY-001-BGE-L')
  })

  it('keeps every variant of one product on the same category + model', () => {
    const skus = [
      { color: 'Black', size: 'S' },
      { color: 'Black', size: 'M' },
      { color: 'Beige', size: 'S' },
    ].map((variant) => buildVariantSku({ category: 'Abaya', model: 1, ...variant }))

    expect(skus).toEqual(['SPL-ABY-001-BLK-S', 'SPL-ABY-001-BLK-M', 'SPL-ABY-001-BGE-S'])
    expect(new Set(skus.map((sku) => sku.split('-').slice(0, 3).join('-'))).size).toBe(1)
  })

  it('falls back to OS when the product has no size', () => {
    expect(buildVariantSku({ category: 'Saree', model: 1, color: 'Black', size: null })).toBe(
      'SPL-SAR-001-BLK-OS',
    )
    expect(buildVariantSku({ category: 'Wallet', model: 8, color: 'Brown', size: '' })).toBe(
      'SPL-WAL-008-BRN-OS',
    )
  })

  it('never emits an undefined or empty segment', () => {
    const sku = buildVariantSku({ category: null, model: null, color: null, size: null })
    expect(sku).toBe('SPL-GEN-001-NA-OS')
    expect(sku).not.toContain('undefined')
    expect(sku.split('-').every((segment) => segment.length > 0)).toBe(true)
  })

  it('uses NA for the "Default" colour placeholder, not DEF', () => {
    expect(colorCode('Default')).toBe('NA')
    expect(buildVariantSku({ category: 'Watch', model: 1, color: 'Default', size: null })).toBe(
      'SPL-WAT-001-NA-OS',
    )
  })

  it('derives a readable code for unmapped categories and colours', () => {
    expect(categoryCode('Lungi')).toBe('LUN')
    expect(colorCode('Turquoise')).toBe('TUR')
    // Nested labels still resolve to the known code.
    expect(categoryCode("Women's Saree")).toBe('SAR')
    expect(categoryCode('kids-footwear')).toBe('SHO')
  })

  it('normalizes size labels into safe segments', () => {
    expect(sizeCode('xl')).toBe('XL')
    expect(sizeCode('2/3')).toBe('23')
    expect(sizeCode(undefined)).toBe('OS')
  })

  it('knows which categories have no size run', () => {
    expect(categoryIsSizeless('Saree')).toBe(true)
    expect(categoryIsSizeless('Wallet')).toBe(true)
    expect(categoryIsSizeless('Watch')).toBe(true)
    expect(categoryIsSizeless('Abaya')).toBe(false)
    expect(categoryIsSizeless('Footwear')).toBe(false)
  })
})

describe('manual SKU validation', () => {
  it('uppercases and strips unsafe characters', () => {
    expect(normalizeSku('  spl aby 001 blk m ')).toBe('SPL-ABY-001-BLK-M')
    expect(normalizeSku('spl_abc/001')).toBe('SPL-ABC001')
  })

  it('rejects values that are too short or empty after normalizing', () => {
    expect(isValidSku('SPL-ABY-001-BLK-M')).toBe(true)
    expect(isValidSku('!!')).toBe(false)
    expect(isValidSku('   ')).toBe(false)
    expect(isValidSku('A'.repeat(81))).toBe(false)
  })
})

describe('internal barcode format', () => {
  it('starts at the configured sequence and is 10 digits', () => {
    expect(BARCODE_START).toBe(1_000_000_001)
    expect(formatBarcode(BARCODE_START)).toBe('1000000001')
    expect(formatBarcode(BARCODE_START + 1)).toBe('1000000002')
    expect(formatBarcode(BARCODE_START)).toHaveLength(10)
  })

  it('accepts only 10-digit values at or above the start', () => {
    expect(isValidInternalBarcode('1000000001')).toBe(true)
    expect(isValidInternalBarcode('0000000001')).toBe(false)
    expect(isValidInternalBarcode('100000000')).toBe(false)
    expect(isValidInternalBarcode('abcdefghij')).toBe(false)
    expect(isValidInternalBarcode(null)).toBe(false)
  })
})
