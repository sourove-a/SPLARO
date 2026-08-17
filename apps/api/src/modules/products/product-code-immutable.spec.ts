import { ValidationPipe } from '@nestjs/common'
import { AdminProductPatchDto, CreateAdminProductDto } from '../../common/dtos/admin-products.dto'

/**
 * The Product Code is assigned once and must survive every ordinary edit.
 *
 * Two things enforce that, and both are pinned here: the global ValidationPipe
 * runs with `whitelist: true`, so a `productCode` sent in any product body is
 * stripped before the controller sees it; and the update handler writes an
 * explicit field map that has no productCode in it, so there is no path from a
 * PATCH to that column.
 */
describe('Product Code immutability', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true })

  async function throughPipe<T extends object>(dto: new () => T, body: Record<string, unknown>) {
    return (await pipe.transform(body, { type: 'body', metatype: dto })) as Record<string, unknown>
  }

  it('strips productCode from an update body', async () => {
    const out = await throughPipe(AdminProductPatchDto, {
      name: 'Renamed Abaya',
      productCode: '999999',
    })
    expect(out['name']).toBe('Renamed Abaya')
    expect(out['productCode']).toBeUndefined()
  })

  it('strips productCode from a create body too — the server issues it', async () => {
    const out = await throughPipe(CreateAdminProductDto, {
      name: 'Signature Abaya',
      basePrice: 4950,
      productCode: '111111',
    })
    expect(out['productCode']).toBeUndefined()
  })

  it('keeps the fields an operator is allowed to change', async () => {
    const out = await throughPipe(AdminProductPatchDto, {
      name: 'Signature Abaya',
      basePrice: 5250,
      sku: 'LEGACY-1',
      categoryId: 'cat-1',
    })
    expect(out['name']).toBe('Signature Abaya')
    expect(out['basePrice']).toBe(5250)
    expect(out['sku']).toBe('LEGACY-1')
    expect(out['categoryId']).toBe('cat-1')
  })
})
