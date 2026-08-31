import { BadRequestException, NotFoundException } from '@nestjs/common'
import { CommerceOsService } from './commerce-os.service'
import { OPENING_STOCK_NOTE } from './wms-stock-summary'

jest.mock('../../common/store.util', () => ({
  resolveStoreId: jest.fn().mockResolvedValue('store-1'),
}))

type Row = {
  id: string
  variantId: string | null
  sku: string | null
  delta: number
  note: string | null
}

function build(opts: { row: Row | null; variantStock?: number | null }) {
  const deleteLog = jest.fn().mockResolvedValue({})
  const updateVariant = jest.fn().mockResolvedValue({})
  const prisma = {
    stockMovementLog: {
      findFirst: jest.fn().mockResolvedValue(opts.row),
      delete: deleteLog,
    },
    productVariant: {
      findFirst: jest.fn().mockResolvedValue(
        opts.variantStock == null ? null : { id: 'v1', stock: opts.variantStock },
      ),
      update: updateVariant,
    },
    // The real client returns each operation's result; only the calls matter here.
    $transaction: jest.fn((ops: unknown[]) => Promise.resolve(ops)),
  }
  const service = new CommerceOsService(prisma as never)
  return { service, prisma, deleteLog, updateVariant }
}

describe('CommerceOsService.deleteStockMovement', () => {
  it('gives back the stock a real movement took', async () => {
    // The row says 50 -> 48. Without that claim the variant holds 50 again.
    const { service, prisma, deleteLog } = build({
      row: { id: 'm1', variantId: 'v1', sku: 'SPL-KRT-337', delta: -2, note: 'typo' },
      variantStock: 48,
    })

    const res = await service.deleteStockMovement('store-1', 'm1')

    expect(res).toEqual({ deleted: true, sku: 'SPL-KRT-337', stockRestored: true, stock: 50 })
    expect(prisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { stock: 50 },
    })
    // Both writes go together, or neither does: Prisma builds each operation
    // and hands the pair to $transaction, so the row is only really gone if
    // the stock update lands with it.
    expect(deleteLog).toHaveBeenCalledWith({ where: { id: 'm1' } })
    const ops = prisma.$transaction.mock.calls[0][0] as unknown[]
    expect(ops).toHaveLength(2)
  })

  it('moves no quantity for an opening-stock row', async () => {
    // These describe stock the product already held. Treating one as a real
    // movement would wipe out the very stock it was describing.
    const { service, prisma, deleteLog } = build({
      row: { id: 'm2', variantId: 'v1', sku: 'SKU-1', delta: 50, note: OPENING_STOCK_NOTE },
      variantStock: 50,
    })

    const res = await service.deleteStockMovement('store-1', 'm2')

    expect(res).toMatchObject({ deleted: true, stockRestored: false })
    expect(prisma.productVariant.update).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(deleteLog).toHaveBeenCalledWith({ where: { id: 'm2' } })
  })

  it('refuses when giving the stock back would go negative', async () => {
    // +80 recorded, but only 10 left on the shelf since.
    const { service, prisma } = build({
      row: { id: 'm3', variantId: 'v1', sku: 'SKU-1', delta: 80, note: 'receipt' },
      variantStock: 10,
    })

    await expect(service.deleteStockMovement('store-1', 'm3')).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(prisma.productVariant.update).not.toHaveBeenCalled()
    expect(prisma.stockMovementLog.delete).not.toHaveBeenCalled()
  })

  it('removes an orphaned row rather than failing on a deleted variant', async () => {
    const { service, deleteLog } = build({
      row: { id: 'm4', variantId: 'gone', sku: 'SKU-1', delta: 5, note: 'receipt' },
      variantStock: null,
    })

    const res = await service.deleteStockMovement('store-1', 'm4')

    expect(res).toMatchObject({ deleted: true, stockRestored: false })
    expect(deleteLog).toHaveBeenCalledWith({ where: { id: 'm4' } })
  })

  it('will not reach a row belonging to another store', async () => {
    // findFirst is scoped by storeId, so another store's row simply is not found.
    const { service } = build({ row: null })
    await expect(service.deleteStockMovement('store-1', 'm5')).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })
})
