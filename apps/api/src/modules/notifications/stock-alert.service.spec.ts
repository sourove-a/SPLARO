import { BadRequestException, NotFoundException } from '@nestjs/common'
import { StockAlertService, variantIsAvailable } from './stock-alert.service'

const STORE = 'store-1'

type VariantSeed = {
  id: string
  stock?: number
  reservedStock?: number
  isActive?: boolean
  size?: string | null
  color?: string | null
  colorName?: string | null
}

function seedVariant(v: VariantSeed) {
  return {
    id: v.id,
    stock: v.stock ?? 0,
    reservedStock: v.reservedStock ?? 0,
    isActive: v.isActive ?? true,
    size: v.size ?? null,
    color: v.color ?? null,
    colorName: v.colorName ?? null,
  }
}

function buildService(opts: {
  product?: { inventoryPolicy?: string; variants?: VariantSeed[] } | null
  existing?: { id: string; notifiedAt: Date | null } | null
} = {}) {
  const product =
    opts.product === null
      ? null
      : {
          id: 'prod-1',
          name: 'Oxford Shirt',
          inventoryPolicy: opts.product?.inventoryPolicy ?? 'DENY',
          variants: (opts.product?.variants ?? [{ id: 'var-1' }]).map(seedVariant),
        }

  const prisma = {
    product: {
      findFirst: jest.fn().mockResolvedValue(product),
      findMany: jest.fn().mockResolvedValue([]),
    },
    stockAlert: {
      findUnique: jest.fn().mockResolvedValue(opts.existing ?? null),
      create: jest.fn().mockResolvedValue({ id: 'alert-1' }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
    },
  }

  return { service: new StockAlertService(prisma as never), prisma }
}

describe('variantIsAvailable', () => {
  it('is false for an inactive variant even with stock', () => {
    expect(variantIsAvailable({ stock: 9, reservedStock: 0, isActive: false }, 'DENY')).toBe(false)
  })

  it('subtracts reserved stock', () => {
    expect(variantIsAvailable({ stock: 3, reservedStock: 3, isActive: true }, 'DENY')).toBe(false)
    expect(variantIsAvailable({ stock: 4, reservedStock: 3, isActive: true }, 'DENY')).toBe(true)
  })

  it('is true at zero when the shop oversells or pre-orders', () => {
    expect(variantIsAvailable({ stock: 0, reservedStock: 0, isActive: true }, 'CONTINUE')).toBe(true)
    expect(variantIsAvailable({ stock: 0, reservedStock: 0, isActive: true }, 'PREORDER')).toBe(true)
  })
})

describe('StockAlertService.subscribe', () => {
  it('needs an email or a phone', async () => {
    const { service } = buildService()
    await expect(service.subscribe(STORE, { productId: 'prod-1' })).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('rejects a malformed email and a non-BD mobile', async () => {
    const { service } = buildService()
    await expect(
      service.subscribe(STORE, { productId: 'prod-1', email: 'not-an-email' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      service.subscribe(STORE, { productId: 'prod-1', phone: '12345' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('refuses an item that is buyable right now', async () => {
    const { service } = buildService({ product: { variants: [{ id: 'var-1', stock: 5 }] } })
    await expect(
      service.subscribe(STORE, { productId: 'prod-1', email: 'a@b.com' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('refuses a product that is not on the storefront', async () => {
    const { service } = buildService({ product: null })
    await expect(
      service.subscribe(STORE, { productId: 'prod-1', email: 'a@b.com' }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('refuses a variant that is not part of the product', async () => {
    const { service } = buildService()
    await expect(
      service.subscribe(STORE, { productId: 'prod-1', variantId: 'other', email: 'a@b.com' }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('stores a lowercased email and a dedupe key covering the whole product', async () => {
    const { service, prisma } = buildService()
    const result = await service.subscribe(STORE, {
      productId: 'prod-1',
      email: '  Shopper@Example.COM ',
    })

    expect(result.alreadySubscribed).toBe(false)
    expect(prisma.stockAlert.create.mock.calls[0][0].data).toMatchObject({
      storeId: STORE,
      productId: 'prod-1',
      channel: 'EMAIL',
      contact: 'shopper@example.com',
      dedupeKey: 'prod-1::EMAIL:shopper@example.com',
    })
    expect(prisma.stockAlert.create.mock.calls[0][0].data.variantId).toBeUndefined()
  })

  it('normalises a BD mobile and keys the alert to the chosen variant', async () => {
    const { service, prisma } = buildService({
      product: { variants: [{ id: 'var-1', size: 'M', colorName: 'Ecru' }] },
    })
    const result = await service.subscribe(STORE, {
      productId: 'prod-1',
      variantId: 'var-1',
      phone: '+8801712345678',
    })

    expect(result.variantName).toBe('Ecru · M')
    expect(prisma.stockAlert.create.mock.calls[0][0].data).toMatchObject({
      channel: 'SMS',
      contact: '01712345678',
      variantId: 'var-1',
      dedupeKey: 'prod-1:var-1:SMS:01712345678',
    })
  })

  it('does not add a second row for the same person and item', async () => {
    const { service, prisma } = buildService({
      existing: { id: 'alert-9', notifiedAt: null },
    })
    const result = await service.subscribe(STORE, { productId: 'prod-1', email: 'a@b.com' })

    expect(result).toMatchObject({ id: 'alert-9', alreadySubscribed: true })
    expect(prisma.stockAlert.create).not.toHaveBeenCalled()
    expect(prisma.stockAlert.update).not.toHaveBeenCalled()
  })

  it('re-arms a row that was already notified once', async () => {
    const { service, prisma } = buildService({
      existing: { id: 'alert-9', notifiedAt: new Date() },
    })
    const result = await service.subscribe(STORE, { productId: 'prod-1', email: 'a@b.com' })

    expect(result.alreadySubscribed).toBe(false)
    expect(prisma.stockAlert.update).toHaveBeenCalledWith({
      where: { id: 'alert-9' },
      data: { notifiedAt: null },
    })
  })
})

describe('StockAlertService.findReady', () => {
  function pending(overrides: {
    product?: Partial<{
      isPublished: boolean
      isHidden: boolean
      status: string
      publishAt: Date | null
      inventoryPolicy: string
      variants: VariantSeed[]
    }>
    variant?: VariantSeed | null
  }) {
    return {
      id: 'alert-1',
      channel: 'EMAIL',
      contact: 'a@b.com',
      unsubscribeToken: 'tok',
      variant: overrides.variant === undefined ? null : overrides.variant ? seedVariant(overrides.variant) : null,
      product: {
        id: 'prod-1',
        name: 'Oxford Shirt',
        slug: 'oxford-shirt',
        isPublished: overrides.product?.isPublished ?? true,
        isHidden: overrides.product?.isHidden ?? false,
        status: overrides.product?.status ?? 'PUBLISHED',
        publishAt: overrides.product?.publishAt ?? null,
        inventoryPolicy: overrides.product?.inventoryPolicy ?? 'DENY',
        variants: (overrides.product?.variants ?? [{ id: 'var-1', stock: 4 }]).map(seedVariant),
      },
    }
  }

  async function readyIds(rows: unknown[]) {
    const { service, prisma } = buildService()
    prisma.stockAlert.findMany.mockResolvedValue(rows)
    return (await service.findReady(STORE, 10)).map((row) => row.id)
  }

  it('returns an alert whose product has stock again', async () => {
    expect(await readyIds([pending({})])).toEqual(['alert-1'])
  })

  it('holds back an alert whose stock is still zero', async () => {
    expect(await readyIds([pending({ product: { variants: [{ id: 'var-1', stock: 0 }] } })])).toEqual([])
  })

  it('never links to a product that has left the storefront', async () => {
    expect(await readyIds([pending({ product: { isPublished: false } })])).toEqual([])
    expect(await readyIds([pending({ product: { isHidden: true } })])).toEqual([])
    expect(await readyIds([pending({ product: { status: 'ARCHIVED' } })])).toEqual([])
    expect(
      await readyIds([pending({ product: { publishAt: new Date(Date.now() + 86_400_000) } })]),
    ).toEqual([])
  })

  it('judges a variant-specific alert on that variant, not the product', async () => {
    const rows = [
      pending({
        variant: { id: 'var-1', stock: 0 },
        product: { variants: [{ id: 'var-1', stock: 0 }, { id: 'var-2', stock: 9 }] },
      }),
    ]
    expect(await readyIds(rows)).toEqual([])
  })
})

describe('StockAlertService.unsubscribe', () => {
  it('rejects an empty token', async () => {
    const { service } = buildService()
    await expect(service.unsubscribe('  ')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('reports whether a row was actually removed', async () => {
    const { service, prisma } = buildService()
    expect(await service.unsubscribe('tok')).toEqual({ removed: true })

    prisma.stockAlert.deleteMany.mockResolvedValue({ count: 0 })
    expect(await service.unsubscribe('tok')).toEqual({ removed: false })
  })
})
