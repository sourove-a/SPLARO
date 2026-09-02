import {
  ORDER_ACTION_STATUS,
  TG_CALLBACK,
  customerCopyKeyboard,
  inlineAdminMenu,
  inlineCustomersMenu,
  inlineMainMenu,
  listCallback,
  mainReplyKeyboard,
  menuMessage,
  orderActionKeyboard,
  parseListCallback,
  parseOrderCallback,
  welcomeMessage,
  controlCenterSections,
  customerCallback,
  parseCustomerCallback,
} from './telegram-ui'
import { tgEmoji } from './telegram-ui-config'
import { formatNewOrderTelegramMessage } from './telegram-order-message'

/** Box-drawing chrome wrapped mid-line on phones — every screen must stay free of it. */
const ASCII_CHROME = /[┌┐└┘│─━]/

function buttonLabels(rows: { text: string }[][]): string[] {
  return rows.flat().map((b) => b.text)
}

function copyPayloads(rows: unknown[][]): string[] {
  return rows
    .flat()
    .map((b) => (b as { copy_text?: { text: string } }).copy_text?.text)
    .filter((t): t is string => Boolean(t))
}

describe('Telegram screens have no ASCII box chrome', () => {
  it('keeps welcome, menu, and order alerts free of box-drawing characters', () => {
    expect(welcomeMessage({ name: 'Sourove', isGroup: false, storeLinked: true })).not.toMatch(
      ASCII_CHROME,
    )
    expect(menuMessage()).not.toMatch(ASCII_CHROME)

    const order = formatNewOrderTelegramMessage({
      invoiceNumber: 'SPL-1001',
      total: 2170,
      subtotal: 2050,
      deliveryCharge: 120,
      discount: 0,
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      orderStatus: 'PENDING',
      shippingName: 'Sourove Ahammed',
      shippingPhone: '01701711252',
      shippingAddress: 'House 84, Road 12',
      shippingCity: 'Dhaka',
      isInsideDhaka: false,
      isCodRisk: false,
      siteUrl: 'https://splaro.co',
      items: [{ productName: 'Cotton Saree', quantity: 1, price: 2050, subtotal: 2050 }],
    })
    expect(order).not.toMatch(ASCII_CHROME)
  })

  it('renders phone and address as tap-to-copy code spans', () => {
    const order = formatNewOrderTelegramMessage({
      invoiceNumber: 'SPL-1001',
      total: 2170,
      subtotal: 2050,
      deliveryCharge: 120,
      discount: 0,
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      orderStatus: 'PENDING',
      shippingName: 'Sourove Ahammed',
      shippingPhone: '01701711252',
      shippingAddress: 'House 84, Road 12',
      shippingCity: 'Dhaka',
      isInsideDhaka: false,
      isCodRisk: false,
      siteUrl: 'https://splaro.co',
      items: [{ productName: 'Cotton Saree', quantity: 1, price: 2050, subtotal: 2050 }],
    })
    expect(order).toContain('<code>01701711252</code>')
    expect(order).toContain('<blockquote>')
    expect(order).toMatch(/📍 <code>House 84, Road 12/)
  })

  it('titles payment status in sentence case instead of shouting PENDING', () => {
    const order = formatNewOrderTelegramMessage({
      invoiceNumber: 'SPL-1002',
      total: 100,
      subtotal: 100,
      deliveryCharge: 0,
      discount: 0,
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      orderStatus: 'PENDING',
      shippingName: 'Rahim',
      shippingPhone: '01700000000',
      shippingAddress: 'Mirpur',
      shippingCity: 'Dhaka',
      isInsideDhaka: true,
      isCodRisk: false,
      siteUrl: 'https://splaro.co',
      items: [{ productName: 'Shirt', quantity: 1, price: 100, subtotal: 100 }],
    })
    expect(order).toContain('COD · Pending')
  })
})

describe('Order action keyboard', () => {
  const links = {
    adminOrderUrl: 'https://admin.splaro.co/dashboard/orders/SPL-1001',
    phone: '01701711252',
    address: 'House 84, Road 12, Uttara, Dhaka 1230',
  }

  it('offers copy buttons for the phone and address a courier asks for', () => {
    const kb = orderActionKeyboard('SPL-1001', { ...links, status: 'PENDING' })
    expect(copyPayloads(kb.inline_keyboard)).toEqual(
      expect.arrayContaining(['01701711252', 'House 84, Road 12, Uttara, Dhaka 1230', 'SPL-1001']),
    )
  })

  it('leads with Confirm while the order is pending', () => {
    const kb = orderActionKeyboard('SPL-1001', { ...links, status: 'PENDING' })
    expect(kb.inline_keyboard[0]?.map((b) => b.text)).toEqual(['✅ Confirm', '🚚 Book Courier'])
  })

  it('switches to fulfilment actions once the order is confirmed', () => {
    const kb = orderActionKeyboard('SPL-1001', { ...links, status: 'CONFIRMED' })
    expect(kb.inline_keyboard[0]?.map((b) => b.text)).toEqual(['🚚 Book Courier', '🎉 Delivered'])
  })

  it('drops Cancel once the order is closed', () => {
    const open = buttonLabels(
      orderActionKeyboard('SPL-1001', { ...links, status: 'PENDING' }).inline_keyboard,
    )
    const closed = buttonLabels(
      orderActionKeyboard('SPL-1001', { ...links, status: 'DELIVERED' }).inline_keyboard,
    )
    expect(open).toContain('❌ Cancel')
    expect(closed).not.toContain('❌ Cancel')
  })

  it('trims an over-long address to Telegram’s copy_text limit', () => {
    const kb = orderActionKeyboard('SPL-1001', { ...links, address: 'x'.repeat(400) })
    for (const payload of copyPayloads(kb.inline_keyboard)) {
      expect(payload.length).toBeLessThanOrEqual(250)
    }
  })
})

describe('Admin login button removal', () => {
  it('is gone from the reply keyboard and the admin desk', () => {
    const replyLabels = mainReplyKeyboard().keyboard.flat() as unknown as string[]
    expect(replyLabels).not.toContain('Admin Login')
    expect(buttonLabels(inlineAdminMenu().inline_keyboard)).not.toContain('Admin Login')
    expect(buttonLabels(inlineMainMenu().inline_keyboard)).not.toContain('Admin Login')
  })
})

describe('Order + list callbacks', () => {
  it('parses every status action the order card can fire', () => {
    expect(parseOrderCallback('order:delivered:SPL-1001')).toEqual({
      action: 'delivered',
      invoice: 'SPL-1001',
    })
    expect(parseOrderCallback('order:cancel:SPL-1001')?.action).toBe('cancel')
    expect(parseOrderCallback('order:open:SPL-1001')?.action).toBe('open')
    expect(parseOrderCallback('order:explode:SPL-1001')).toBeNull()
  })

  it('maps status actions to the transitions OrderStatusService accepts', () => {
    expect(ORDER_ACTION_STATUS.delivered).toBe('DELIVERED')
    expect(ORDER_ACTION_STATUS.cancel).toBe('CANCELLED')
    expect(ORDER_ACTION_STATUS.returned).toBe('RETURNED')
    expect(ORDER_ACTION_STATUS.track).toBeUndefined()
  })

  it('paginates the pending queue separately from the latest-orders list', () => {
    expect(parseListCallback(listCallback('pending', 2))).toEqual({ kind: 'pending', page: 2 })
    expect(parseListCallback(listCallback('orders', 0))).toEqual({ kind: 'orders', page: 0 })
  })
})

describe('Customer desk', () => {
  it('exposes lookup and top-customer entries', () => {
    const labels = buttonLabels(inlineCustomersMenu().inline_keyboard)
    expect(labels).toContain('Top Customers')
    // Was "Phone Lookup" while a whole mobile number was the only thing it took.
    // The same entry now searches names, emails and customer codes as well, and
    // the label has to stop promising less than the screen does.
    expect(labels).toContain('Search Customer')
    expect(labels).toContain('All Customers')
    expect(buttonLabels(inlineMainMenu().inline_keyboard)).toContain('◐ Customer Desk')
    expect(TG_CALLBACK.MENU_CUSTOMERS).toBe('menu:customers')
  })

  it('copies phone and address from a customer card', () => {
    const kb = customerCopyKeyboard({
      phone: '01701711252',
      address: 'Uttara, Dhaka',
      invoice: 'SPL-1001',
    })
    expect(copyPayloads(kb.inline_keyboard)).toEqual(['01701711252', 'Uttara, Dhaka'])
    expect(buttonLabels(kb.inline_keyboard as { text: string }[][])).toContain('📦 Open order')
  })
})

describe('Custom emoji entities never reach Telegram unusable', () => {
  it('keeps welcome and menu free of tg-emoji tags', () => {
    // A <tg-emoji> wrapping a non-emoji glyph made Telegram answer
    // 400 ENTITY_TEXT_INVALID and drop the whole message, so Control Center
    // silently returned nothing while every other desk still replied.
    expect(welcomeMessage({ name: 'Sourove', isGroup: false, storeLinked: true })).not.toContain(
      '<tg-emoji',
    )
    expect(menuMessage()).not.toContain('<tg-emoji')
    expect(controlCenterSections()).not.toContain('<tg-emoji')
  })

  it('returns the bare glyph when the fallback is not an emoji', () => {
    expect(tgEmoji('orders', '▣')).toBe('▣')
  })
})

describe('customer callbacks', () => {
  it('round-trips an action, phone and page', () => {
    expect(parseCustomerCallback(customerCallback('orders', '01712345678', 2))).toEqual({
      action: 'orders',
      phone: '01712345678',
      page: 2,
    })
    expect(parseCustomerCallback(customerCallback('open', '01712345678'))).toEqual({
      action: 'open',
      phone: '01712345678',
      page: 0,
    })
  })

  it('strips a written number down to digits so the payload stays inside 64 bytes', () => {
    const data = customerCallback('open', '+880 1712-345678')
    expect(data).toBe('cust:open:8801712345678:0')
    expect(Buffer.byteLength(data, 'utf8')).toBeLessThanOrEqual(64)
    expect(parseCustomerCallback(data)?.phone).toBe('8801712345678')
  })

  it('refuses anything that is not a customer callback', () => {
    expect(parseCustomerCallback('cust:delete:01712345678:0')).toBeNull()
    expect(parseCustomerCallback('order:confirm:SPL-1001')).toBeNull()
    expect(parseCustomerCallback('cust:open::0')).toBeNull()
    expect(parseCustomerCallback('cust:open:abc:0')).toBeNull()
  })
})

describe('customer list paging', () => {
  it('is carried by the same list callback as orders', () => {
    expect(parseListCallback(listCallback('customers', 3))).toEqual({ kind: 'customers', page: 3 })
  })

  it('still refuses an unknown list kind', () => {
    expect(parseListCallback('list:invoices:0')).toBeNull()
  })
})
