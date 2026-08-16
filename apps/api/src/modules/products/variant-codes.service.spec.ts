import { BadRequestException } from '@nestjs/common'
import { BARCODE_START } from '@splaro/config'
import type { Prisma } from '@prisma/client'
import type { PrismaService } from '../../common/prisma.service'
import { reserveBarcodes } from './barcode-sequence.service'
import {
  VariantSkuService,
  buildSkuForVariant,
  ensureProductSkuIdentity,
  uniqueGeneratedSku,
} from './variant-sku.service'

type QueryRawMock = jest.Mock
type TxMock = Prisma.TransactionClient & {
  $queryRaw: QueryRawMock
  $executeRaw: jest.Mock
}

/**
 * Counter-backed fake mirroring `UPDATE ... RETURNING "nextValue"`.
 *
 * `nextValue` holds the code that will be handed out *next* (the migration
 * seeds it to BARCODE_START), so the fake starts there too.
 */
function txWithCounter(start: bigint) {
  let value = start
  const $queryRaw = jest.fn(async (strings: TemplateStringsArray, ...params: unknown[]) => {
    const sql = strings.join(' ')
    if (sql.includes('"CodeSequence"')) {
      // The size increment is the first interpolated value in the barcode query.
      const step = typeof params[0] === 'bigint' ? params[0] : 1n
      value += step
      return [{ nextValue: value }]
    }
    return []
  }) as unknown as QueryRawMock

  return {
    $queryRaw,
    $executeRaw: jest.fn().mockResolvedValue(1),
  } as unknown as TxMock
}

describe('reserveBarcodes', () => {
  it('starts at the configured sequence value', async () => {
    const tx = txWithCounter(BigInt(BARCODE_START))
    await expect(reserveBarcodes(tx, 1)).resolves.toEqual(['1000000001'])
  })

  it('hands out consecutive codes for a 6-variant matrix', async () => {
    const tx = txWithCounter(BigInt(BARCODE_START))
    await expect(reserveBarcodes(tx, 6)).resolves.toEqual([
      '1000000001',
      '1000000002',
      '1000000003',
      '1000000004',
      '1000000005',
      '1000000006',
    ])
  })

  it('advances the counter atomically instead of reading MAX(barcode)', async () => {
    const tx = txWithCounter(BigInt(BARCODE_START))
    await reserveBarcodes(tx, 2)

    const sql = (tx.$queryRaw as jest.Mock).mock.calls
      .map((call) => (call[0] as TemplateStringsArray).join(' '))
      .join('\n')
    expect(sql).toContain('UPDATE "CodeSequence"')
    expect(sql).toContain('RETURNING "nextValue"')
    expect(sql).not.toMatch(/MAX\(/i)
  })

  it('two sequential callers never receive the same code', async () => {
    const tx = txWithCounter(BigInt(BARCODE_START))
    const first = await reserveBarcodes(tx, 3)
    const second = await reserveBarcodes(tx, 3)
    expect(new Set([...first, ...second]).size).toBe(6)
  })

  it('reserves nothing when asked for zero', async () => {
    const tx = txWithCounter(BigInt(BARCODE_START))
    await expect(reserveBarcodes(tx, 0)).resolves.toEqual([])
    expect(tx.$queryRaw).not.toHaveBeenCalled()
  })
})

describe('ensureProductSkuIdentity', () => {
  it('reuses the model number a product already owns', async () => {
    const update = jest.fn()
    const tx = {
      product: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ skuCategoryCode: 'ABY', skuModelNumber: 7, category: null }),
        update,
      },
    } as unknown as Prisma.TransactionClient

    await expect(
      ensureProductSkuIdentity(tx, { productId: 'p1', storeId: 's1' }),
    ).resolves.toEqual({ categoryCode: 'ABY', modelNumber: 7 })
    // Adding a colour later must not renumber the model.
    expect(update).not.toHaveBeenCalled()
  })

  it('allocates and persists an identity on first use', async () => {
    const update = jest.fn()
    const tx = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          skuCategoryCode: null,
          skuModelNumber: null,
          category: { name: 'Saree', slug: 'sarees' },
        }),
        update,
        aggregate: jest.fn().mockResolvedValue({ _max: { skuModelNumber: 2 } }),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([{ nextValue: 4n }]),
    } as unknown as Prisma.TransactionClient

    await expect(
      ensureProductSkuIdentity(tx, { productId: 'p1', storeId: 's1' }),
    ).resolves.toEqual({ categoryCode: 'SAR', modelNumber: 3 })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { skuCategoryCode: 'SAR', skuModelNumber: 3 },
      }),
    )
  })
})

describe('uniqueGeneratedSku', () => {
  const txWithTaken = (taken: Record<string, string>) =>
    ({
      productVariant: {
        findUnique: jest.fn(async ({ where }: { where: { sku: string } }) =>
          taken[where.sku] ? { id: taken[where.sku] } : null,
        ),
      },
    }) as unknown as Prisma.TransactionClient

  it('returns the generated code when nothing owns it', async () => {
    await expect(uniqueGeneratedSku(txWithTaken({}), 'SPL-ABY-001-BLK-M')).resolves.toBe(
      'SPL-ABY-001-BLK-M',
    )
  })

  it('disambiguates when another product already owns the code', async () => {
    const tx = txWithTaken({ 'SPL-ABY-001-BLK-M': 'other-variant' })
    await expect(uniqueGeneratedSku(tx, 'SPL-ABY-001-BLK-M')).resolves.toBe(
      'SPL-ABY-001-BLK-M-2',
    )
  })

  it('ignores the variant being edited', async () => {
    const tx = txWithTaken({ 'SPL-ABY-001-BLK-M': 'v1' })
    await expect(uniqueGeneratedSku(tx, 'SPL-ABY-001-BLK-M', 'v1')).resolves.toBe(
      'SPL-ABY-001-BLK-M',
    )
  })
})

describe('VariantSkuService manual entry', () => {
  const service = new VariantSkuService({} as PrismaService)

  it('treats blank input as "generate one for me"', () => {
    expect(service.normalizeManual('')).toBeNull()
    expect(service.normalizeManual('   ')).toBeNull()
    expect(service.normalizeManual(undefined)).toBeNull()
  })

  it('uppercases and hyphenates an operator-typed SKU', () => {
    expect(service.normalizeManual(' spl aby 001 blk m ')).toBe('SPL-ABY-001-BLK-M')
  })

  it('rejects a SKU that cannot be normalized into a safe code', () => {
    expect(() => service.normalizeManual('!!')).toThrow(BadRequestException)
  })

  it('blocks a duplicate SKU rather than overwriting the existing variant', async () => {
    const tx = {
      productVariant: { findUnique: jest.fn().mockResolvedValue({ id: 'other' }) },
    } as unknown as Prisma.TransactionClient

    await expect(service.assertAvailable(tx, 'SPL-ABY-001-BLK-M')).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })
})

describe('buildSkuForVariant', () => {
  const identity = { categoryCode: 'ABY', modelNumber: 1 }

  it('prefers colorName over the raw colour value', () => {
    expect(buildSkuForVariant(identity, { colorName: 'Beige', color: '#ddd', size: 'L' })).toBe(
      'SPL-ABY-001-BGE-L',
    )
  })

  it('produces one code per colour when the product has no sizes', () => {
    const skus = ['Black', 'Beige'].map((colorName) =>
      buildSkuForVariant({ categoryCode: 'SAR', modelNumber: 1 }, { colorName, size: null }),
    )
    expect(skus).toEqual(['SPL-SAR-001-BLK-OS', 'SPL-SAR-001-BGE-OS'])
    expect(new Set(skus).size).toBe(2)
  })
})
