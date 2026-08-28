import { ProcurementMailerService, toEmailLineItems } from './procurement-mailer.service'
import type { PrismaService } from '../../common/prisma.service'
import type { EmailService } from '../email/email.service'

const payload = {
  kind: 'purchase-order' as const,
  supplier: { name: 'Sojib Mirja', email: 'sojib@example.com' },
  poNumber: 'PO-0001',
  purchasedAt: new Date('2026-08-28T10:00:00.000Z'),
  expectedAt: null,
  items: [{ name: 'Panjabi', quantity: 5, unitCost: 480, lineTotal: 2400 }],
  totals: {
    subtotal: 2400,
    discount: 0,
    transportCost: 0,
    otherCost: 0,
    total: 2400,
    paidAmount: 0,
    dueAmount: 2400,
  },
}

function build(sendResult: boolean | Error = true) {
  const sendForStore = jest.fn(() =>
    sendResult instanceof Error ? Promise.reject(sendResult) : Promise.resolve(sendResult),
  )
  const prisma = {
    store: { findUnique: jest.fn().mockResolvedValue({ name: 'SPLARO', phone: '019', email: 'a@b.c' }) },
    purchaseOrder: { findFirst: jest.fn() },
  } as unknown as PrismaService
  const service = new ProcurementMailerService(prisma, { sendForStore } as unknown as EmailService)
  return { service, sendForStore, prisma }
}

describe('ProcurementMailerService', () => {
  it('sends the document and says where it went', async () => {
    const { service, sendForStore } = build(true)
    const result = await service.send('store-1', payload)

    expect(result).toMatchObject({ emailed: true, reason: 'sent', to: 'sojib@example.com' })
    expect(sendForStore).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'sojib@example.com',
        // Supplier paperwork is correspondence about money owed, so it must not
        // be gated behind the storefront's marketing email switch.
        transactional: true,
      }),
    )
  })

  it('does not attempt a send for a supplier with no address, and says so', async () => {
    const { service, sendForStore } = build(true)
    const result = await service.send('store-1', {
      ...payload,
      supplier: { name: 'Sojib Mirja', email: null },
    })

    expect(result.emailed).toBe(false)
    expect(result.reason).toBe('no-address')
    expect(result.detail).toContain('no email address on file')
    expect(sendForStore).not.toHaveBeenCalled()
  })

  it('reports a rejected send as failed rather than silently succeeding', async () => {
    const { service } = build(false)
    const result = await service.send('store-1', payload)

    expect(result.emailed).toBe(false)
    expect(result.reason).toBe('failed')
    expect(result.detail).toContain('no working SMTP')
  })

  it('swallows a thrown send — the purchase order is already committed', async () => {
    const { service } = build(new Error('smtp exploded'))
    const result = await service.send('store-1', payload)

    expect(result.emailed).toBe(false)
    expect(result.reason).toBe('failed')
    expect(result.detail).toContain('smtp exploded')
  })

  it('treats a garbled address as no address', async () => {
    const { service, sendForStore } = build(true)
    const result = await service.send('store-1', {
      ...payload,
      supplier: { name: 'Sojib Mirja', email: '   not-an-email   ' },
    })

    expect(result.reason).toBe('no-address')
    expect(sendForStore).not.toHaveBeenCalled()
  })
})

describe('toEmailLineItems', () => {
  it('flattens Prisma Decimals so the template never prints [object Object]', () => {
    const [line] = toEmailLineItems([
      {
        productName: 'Panjabi',
        sku: 'PNJ-1',
        quantity: 2,
        unitCost: { toString: () => '480.00' },
        lineTotal: { toString: () => '960.00' },
      },
    ])
    expect(line).toEqual({
      name: 'Panjabi',
      detail: 'PNJ-1',
      quantity: 2,
      unitCost: 480,
      lineTotal: 960,
    })
  })
})
