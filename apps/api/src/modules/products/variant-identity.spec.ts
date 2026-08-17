import { isValidCategoryCode } from '@splaro/config'
import {
  buildIdentityCodes,
  resolveColourSerials,
  usesNumericIdentity,
} from './variant-sku.service'

/**
 * The rules that make a variant SKU safe to print on a label:
 * issued once, never recomputed, and identical whether it came from the admin
 * panel or the CSV importer (both call the helpers exercised here).
 */

function variantsTx(rows: { colorSerial: number | null; colorName: string | null }[]) {
  return {
    productVariant: { findMany: () => Promise.resolve(rows) },
  } as never
}

const shoes = { categoryCode: '405', modelNumber: 1 }
const legacy = { categoryCode: 'SHO', modelNumber: 1 }

describe('colour serials', () => {
  it('numbers new colours in the order they appear', async () => {
    const serials = await resolveColourSerials(variantsTx([]), null, ['White', 'Black', 'Navy'])
    expect(serials.get('white')).toBe(1)
    expect(serials.get('black')).toBe(2)
    expect(serials.get('navy')).toBe(3)
  })

  it('reuses the serial a colour already holds', async () => {
    const tx = variantsTx([
      { colorSerial: 1, colorName: 'White' },
      { colorSerial: 2, colorName: 'Black' },
    ])
    const serials = await resolveColourSerials(tx, 'product-1', ['Black', 'White'])
    expect(serials.get('black')).toBe(2)
    expect(serials.get('white')).toBe(1)
  })

  it('gives a colour added later the next free number', async () => {
    const tx = variantsTx([
      { colorSerial: 1, colorName: 'White' },
      { colorSerial: 2, colorName: 'Black' },
    ])
    const serials = await resolveColourSerials(tx, 'product-1', ['Navy'])
    expect(serials.get('navy')).toBe(3)
  })

  it('is case- and whitespace-insensitive, so one colour cannot take two serials', async () => {
    const tx = variantsTx([{ colorSerial: 1, colorName: 'White' }])
    const serials = await resolveColourSerials(tx, 'product-1', ['  white  ', 'WHITE'])
    expect(serials.get('white')).toBe(1)
    expect(serials.size).toBe(1)
  })
})

describe('issued codes', () => {
  it('builds SKU and barcode from one identity', () => {
    const codes = buildIdentityCodes(shoes, { size: '42', colourSerial: 1 })
    expect(codes.sku).toBe('405-0001-01-42')
    expect(codes.barcode).toBe('4050001011846')
    expect(codes.colorSerial).toBe(1)
  })

  it('does not change when the colour is renamed', () => {
    // The serial is the input, not the name — "Silver" becoming "Metallic
    // Silver" leaves every printed label valid.
    const before = buildIdentityCodes(shoes, { size: '42', colourSerial: 1, colorName: 'Silver' })
    const after = buildIdentityCodes(shoes, {
      size: '42',
      colourSerial: 1,
      colorName: 'Metallic Silver',
    })
    expect(after.sku).toBe(before.sku)
    expect(after.barcode).toBe(before.barcode)
  })

  it('gives each size in a run its own pair of codes', () => {
    const run = ['40', '41', '42', '43'].map((size) =>
      buildIdentityCodes(shoes, { size, colourSerial: 1 }),
    )
    expect(new Set(run.map((r) => r.sku)).size).toBe(4)
    expect(new Set(run.map((r) => r.barcode)).size).toBe(4)
  })

  it('separates colours of the same size', () => {
    const white = buildIdentityCodes(shoes, { size: '42', colourSerial: 1 })
    const black = buildIdentityCodes(shoes, { size: '42', colourSerial: 2 })
    expect(white.sku).not.toBe(black.sku)
    expect(white.barcode).not.toBe(black.barcode)
  })

  it('leaves legacy products on their old scheme', () => {
    // Their labels are printed; a cosmetic rewrite would invalidate them.
    expect(usesNumericIdentity(legacy)).toBe(false)
    const codes = buildIdentityCodes(legacy, { size: 'M', colourSerial: 1, colorName: 'Black' }, '1000000042')
    expect(codes.sku).toBe('SPL-SHO-001-BLK-M')
    expect(codes.barcode).toBe('1000000042')
    expect(codes.colorSerial).toBeNull()
  })

  it('treats a numeric category code as the current scheme', () => {
    expect(usesNumericIdentity(shoes)).toBe(true)
    expect(isValidCategoryCode(shoes.categoryCode)).toBe(true)
  })
})
