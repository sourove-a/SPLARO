import { TelegramService } from './telegram.service'

/**
 * The desk as an operator meets it: what a typed query finds, and what the
 * card says once it has found someone. Prisma and the bot are stubbed, so what
 * is under test is the merging and the message rather than the database.
 */

type Ctx = { chatId: string; userId: string; storeId: string; configId: string; isGroup: boolean }

const CTX: Ctx = {
  chatId: '100',
  userId: '200',
  storeId: 'store-1',
  configId: 'cfg-1',
  isGroup: false,
}

function build(data: {
  customers?: unknown[]
  orders?: unknown[]
  orderCount?: number
  customerCount?: number
}) {
  const sent: Array<{ text: string; options?: Record<string, unknown> }> = []
  const prisma = {
    customer: {
      findMany: jest.fn().mockResolvedValue(data.customers ?? []),
      findFirst: jest.fn().mockResolvedValue((data.customers ?? [])[0] ?? null),
      count: jest.fn().mockResolvedValue(data.customerCount ?? (data.customers ?? []).length),
    },
    order: {
      findMany: jest.fn().mockResolvedValue(data.orders ?? []),
      count: jest.fn().mockResolvedValue(data.orderCount ?? (data.orders ?? []).length),
      aggregate: jest.fn().mockResolvedValue({ _sum: { total: 0 } }),
    },
    telegramCommandLog: { create: jest.fn().mockResolvedValue({}) },
  }
  const service = new TelegramService(
    { get: () => undefined } as never,
    prisma as never,
    {} as never,
    { checkCustomerFraud: jest.fn().mockResolvedValue(null) } as never,
    {} as never,
    {} as never,
    {} as never,
  )
  const inner = service as unknown as {
    bot: unknown
    checkUserPermission: unknown
    logCommand: unknown
  }
  inner.bot = {
    sendMessage: jest.fn((_chat: string, text: string, options?: Record<string, unknown>) => {
      sent.push({ text, options })
      return Promise.resolve({})
    }),
  }
  inner.checkUserPermission = jest.fn().mockResolvedValue(true)
  inner.logCommand = jest.fn().mockResolvedValue(undefined)
  return { service: service as never as Record<string, (...a: unknown[]) => Promise<void>>, sent, prisma }
}

const CUSTOMER = {
  customerCode: 'CUS-00123',
  firstName: 'Rahim',
  lastName: 'Uddin',
  email: 'rahim@example.com',
  phone: '01712345678',
  totalOrders: 4,
  totalSpent: 12500,
  avgOrderValue: 3125,
  loyaltyPoints: 640,
  loyaltyTier: 'GOLD',
  vipScore: 72,
  codRiskScore: 15,
  tags: ['repeat', 'dhaka'],
  firstOrderDate: new Date('2026-01-02T10:00:00Z'),
  lastOrderDate: new Date('2026-08-20T10:00:00Z'),
}

describe('customer lookup', () => {
  it('finds a registered customer who has never ordered', async () => {
    // The old lookup read Order.shippingPhone alone, so this person — an
    // account with no order row — came back as "No customer found".
    const { service, sent } = build({ customers: [CUSTOMER], orders: [], orderCount: 0 })

    await service.executeCustomerLookup(CTX, '01712345678')

    expect(sent).toHaveLength(1)
    expect(sent[0]!.text).toContain('Rahim Uddin')
    expect(sent[0]!.text).not.toContain('No customer found')
    expect(sent[0]!.text).toContain('Registered customer')
  })

  it('puts the lifetime figures on the card', async () => {
    const { service, sent } = build({ customers: [CUSTOMER], orders: [], orderCount: 0 })

    await service.executeCustomerLookup(CTX, '01712345678')
    const text = sent[0]!.text

    // None of these live on an order row, which is why the old card never showed them.
    expect(text).toContain('CUS-00123')
    expect(text).toContain('rahim@example.com')
    expect(text).toContain('GOLD')
    expect(text).toContain('640')
    expect(text).toContain('dhaka')
  })

  it('counts one person once when they are in both tables', async () => {
    // Written with a +88 prefix on one side and a leading 0 on the other.
    const { service, sent } = build({
      customers: [{ ...CUSTOMER, phone: '+8801712345678' }],
      orders: [
        {
          shippingPhone: '01712345678',
          shippingName: 'Rahim Uddin',
          invoiceNumber: 'SPL-1001',
          status: 'DELIVERED',
          total: 3125,
          shippingAddress: 'Road 4, Banani',
          shippingCity: 'Dhaka',
          shippingDistrict: 'Dhaka',
          createdAt: new Date('2026-08-20T10:00:00Z'),
        },
      ],
      orderCount: 4,
    })

    await service.executeCustomerLookup(CTX, '01712345678')

    // One match goes straight to the card; two would have drawn a picker.
    expect(sent[0]!.text).not.toContain('2 matches')
    expect(sent[0]!.text).toContain('Rahim Uddin')
  })

  it('offers a picker when a name matches several people', async () => {
    const { service, sent } = build({
      customers: [
        { ...CUSTOMER, phone: '01712345678', firstName: 'Rahim', lastName: 'Uddin' },
        { ...CUSTOMER, phone: '01898765432', firstName: 'Rahim', lastName: 'Ali' },
      ],
      orders: [],
    })

    await service.executeCustomerLookup(CTX, 'Rahim')

    expect(sent[0]!.text).toContain('2 matches')
    const keyboard = (sent[0]!.options?.reply_markup as { inline_keyboard: unknown[][] }).inline_keyboard
    // One button per person, plus the way back.
    expect(keyboard).toHaveLength(3)
  })

  it('asks for more than two digits rather than returning the whole shop', async () => {
    const { service, sent, prisma } = build({})

    await service.executeCustomerLookup(CTX, '12')

    expect(prisma.customer.findMany).not.toHaveBeenCalled()
    expect(sent[0]!.text).toContain('Customer Search')
  })

  it('says so plainly when nobody matches', async () => {
    const { service, sent } = build({ customers: [], orders: [] })

    await service.executeCustomerLookup(CTX, '01700000000')

    expect(sent[0]!.text).toContain('No customer found')
  })
})

describe('customer list', () => {
  it('pages the book and gives every row a button', async () => {
    const people = Array.from({ length: 8 }, (_, i) => ({
      firstName: `Buyer${i}`,
      lastName: 'X',
      phone: `0171234567${i}`,
      totalOrders: i,
      totalSpent: i * 100,
      loyaltyTier: 'BRONZE',
    }))
    const { service, sent } = build({ customers: people, customerCount: 20 })

    await service.executeCustomerList(CTX, 1)

    expect(sent[0]!.text).toContain('20 registered')
    expect(sent[0]!.text).toContain('page 2 of 3')
    const keyboard = (sent[0]!.options?.reply_markup as { inline_keyboard: Array<Array<{ callback_data: string }>> })
      .inline_keyboard
    // Eight people, a prev/next row, and the way back.
    expect(keyboard).toHaveLength(10)
    expect(keyboard[0]![0]!.callback_data).toMatch(/^cust:open:/)
  })

  it('tells an empty store that guests are still searchable', async () => {
    const { service, sent } = build({ customers: [], customerCount: 0 })

    await service.executeCustomerList(CTX, 0)

    expect(sent[0]!.text).toContain('No customers yet')
    expect(sent[0]!.text).toContain('Guest buyers still show up')
  })
})
