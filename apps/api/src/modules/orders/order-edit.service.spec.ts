import { BadRequestException } from '@nestjs/common'
import { OrderEditService } from './order-edit.service'

const baseOrder = {
  id: 'o1',
  invoiceNumber: 'SPL-1001',
  storeId: 'store-1',
  status: 'PENDING',
  paymentStatus: 'UNPAID',
  subtotal: 100,
  deliveryCharge: 60,
  discount: 0,
  total: 160,
  couponId: null,
  shippingName: 'Customer',
  shippingPhone: '01700000000',
  shippingEmail: 'customer@example.com',
  shippingAddress: '1 Main Road',
  shippingCity: 'Uttara',
  shippingDistrict: 'Dhaka',
  shippingDivision: 'Dhaka',
  shippingPostal: null,
  items: [{ id: 'line-1', variantId: 'old-v', productId: 'old-p', quantity: 1, productName: 'Old item' }],
  courier: null,
  stockReservation: null,
}

function buildService(order: Record<string, unknown> = baseOrder) {
  const tx = {
    productVariant: {
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue({ stock: 4 }),
    },
    inventoryLog: { create: jest.fn().mockResolvedValue({}) },
    orderItem: {
      deleteMany: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
    order: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    orderNote: { create: jest.fn().mockResolvedValue({}) },
    orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    $executeRawUnsafe: jest.fn().mockResolvedValue(1),
  }
  const prisma = {
    order: { findUnique: jest.fn().mockResolvedValue(order) },
    productVariant: { findMany: jest.fn() },
    siteSettings: { findUnique: jest.fn().mockResolvedValue({
      dhakaDeliveryCharge: 60,
      outsideDhakaCharge: 120,
      freeDeliveryThreshold: 0,
    }) },
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  }
  const financeAudit = { log: jest.fn().mockResolvedValue(undefined) }
  const notifications = { onOrderEdited: jest.fn().mockResolvedValue(true) }
  const service = new OrderEditService(
    prisma as never,
    financeAudit as never,
    notifications as never,
  )
  return { service, prisma, tx, financeAudit, notifications }
}

describe('OrderEditService', () => {
  it('recomputes prices and delivery, moves COD stock, audits, and emails', async () => {
    const { service, prisma, tx, financeAudit, notifications } = buildService()
    prisma.productVariant.findMany.mockResolvedValue([{
      id: 'new-v',
      productId: 'new-p',
      sku: 'NEW-38',
      size: '38',
      color: 'black',
      colorName: 'Black',
      image: null,
      price: 200,
      stock: 5,
      reservedStock: 0,
      isActive: true,
      product: {
        name: 'New item',
        basePrice: 200,
        productCode: 'NEW',
        inventoryPolicy: 'DENY',
        images: [{ url: '/uploads/new.webp' }],
      },
    }])

    const result = await service.edit('o1', {
      items: [{ variantId: 'new-v', quantity: 1 }],
      shipping: { district: 'Chattogram' },
      note: 'Customer requested the correct size',
    }, 'admin-1')

    expect(result).toMatchObject({
      emailSent: true,
      changes: expect.arrayContaining(['items updated', 'district updated', 'delivery charge recalculated']),
      order: { subtotal: 200, deliveryCharge: 120, total: 320 },
    })
    expect(tx.orderItem.deleteMany).toHaveBeenCalledWith({ where: { orderId: 'o1' } })
    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'o1' },
      data: expect.objectContaining({ subtotal: 200, deliveryCharge: 120, total: 320 }),
    }))
    expect(tx.inventoryLog.create).toHaveBeenCalled()
    expect(financeAudit.log).toHaveBeenCalled()
    expect(notifications.onOrderEdited).toHaveBeenCalledWith(
      'store-1',
      'o1',
      expect.objectContaining({ changes: expect.any(Array) }),
    )
  })

  it('refuses orders past the pre-shipping window', async () => {
    const { service, tx } = buildService({ ...baseOrder, status: 'SHIPPED' })

    await expect(service.edit('o1', { shipping: { address: 'New address' } }))
      .rejects.toBeInstanceOf(BadRequestException)
    expect(tx.order.update).not.toHaveBeenCalled()
  })

  it('refuses an order whose courier parcel is already booked', async () => {
    const { service, tx } = buildService({
      ...baseOrder,
      courier: { consignmentId: 'CN-1' },
    })

    await expect(service.edit('o1', { shipping: { address: 'New address' } }))
      .rejects.toThrow(/courier consignment/i)
    expect(tx.order.update).not.toHaveBeenCalled()
  })

  it('refuses item changes after payment', async () => {
    const { service, prisma } = buildService({ ...baseOrder, paymentStatus: 'PAID' })

    await expect(service.edit('o1', { items: [{ variantId: 'new-v', quantity: 1 }] }))
      .rejects.toThrow(/already paid/i)
    expect(prisma.productVariant.findMany).not.toHaveBeenCalled()
  })

  it('refuses an item increase beyond available stock', async () => {
    const { service, prisma, tx } = buildService()
    prisma.productVariant.findMany.mockResolvedValue([{
      id: 'new-v',
      productId: 'new-p',
      sku: 'NEW-38',
      size: '38',
      color: 'black',
      colorName: 'Black',
      image: null,
      price: 200,
      stock: 0,
      reservedStock: 0,
      isActive: true,
      product: {
        name: 'New item',
        basePrice: 200,
        productCode: 'NEW',
        inventoryPolicy: 'DENY',
        images: [],
      },
    }])
    tx.$executeRawUnsafe.mockResolvedValue(0)

    await expect(service.edit('o1', { items: [{ variantId: 'new-v', quantity: 1 }] }))
      .rejects.toThrow(/not enough stock/i)
    expect(tx.order.update).not.toHaveBeenCalled()
  })
})
