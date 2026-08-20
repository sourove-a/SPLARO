import { aiPromptForAction, TG_CALLBACK, parseListCallback, premiumHeader, welcomeMessage } from './telegram-ui'
import { escapeTelegramHtml, stripTelegramHtml } from './telegram.util'

/**
 * A Telegram display name is arbitrary user text. Telegram rejects the *entire*
 * message with 400 "can't parse entities" if a stray `<` reaches parse_mode HTML,
 * which is how a real account named "🐊 …<Udman>!" got no /start reply at all.
 */
describe('Telegram HTML safety', () => {
  const HOSTILE = '🐊 𝕄𝕒Řˇᵏ<Udman>!'

  it('escapes a display name that would break the HTML parser', () => {
    const html = welcomeMessage({ name: HOSTILE, isGroup: false, storeLinked: true })
    expect(html).not.toContain('<Udman>')
    expect(html).toContain('&lt;Udman&gt;')
  })

  it('keeps the greeting readable after escaping', () => {
    const html = welcomeMessage({ name: HOSTILE, isGroup: false, storeLinked: true })
    expect(html).toContain('🐊')
    expect(html).toContain('Hi <b>')
  })

  it('leaves the template markup intact', () => {
    const html = welcomeMessage({ name: 'Sourove', isGroup: false, storeLinked: true })
    expect(html).toContain('SPLARO Commerce OS')
    expect(html).toContain('Hi <b>Sourove</b>')
  })

  it('handles a missing name without emitting "undefined"', () => {
    const html = welcomeMessage({ isGroup: true, storeLinked: false })
    expect(html).toContain('Welcome')
    expect(html).not.toContain('undefined')
  })

  it('shows the new control-center sections in the welcome copy', () => {
    const html = welcomeMessage({ name: 'Sourove', isGroup: false, storeLinked: true })
    expect(html).toContain('Orders Desk')
    expect(html).toContain('Courier Hub')
    expect(html).toContain('Inventory Desk')
  })

  describe('escapeTelegramHtml', () => {
    it('escapes the three characters Telegram treats as markup', () => {
      expect(escapeTelegramHtml('a<b>&c')).toBe('a&lt;b&gt;&amp;c')
    })

    it('is safe to run on text with no markup', () => {
      expect(escapeTelegramHtml('Pink Printed Cotton Saree')).toBe('Pink Printed Cotton Saree')
    })
  })

  describe('stripTelegramHtml (plain-text fallback)', () => {
    it('produces readable text from a formatted message', () => {
      const plain = stripTelegramHtml('✨ <b>SPLARO</b>\nHi <b>Sourove</b> · <i>ready</i>')
      expect(plain).toBe('✨ SPLARO\nHi Sourove · ready')
    })

    it('restores escaped characters so the reader sees the real name', () => {
      const html = welcomeMessage({ name: HOSTILE, isGroup: false, storeLinked: true })
      expect(stripTelegramHtml(html)).toContain('<Udman>')
    })

    it('turns <br> into a newline', () => {
      expect(stripTelegramHtml('one<br/>two')).toBe('one\ntwo')
    })
  })

  describe('formatWhatsAppUrl', () => {
    it('normalizes local BD 11-digit numbers to wa.me with 880 prefix', () => {
      const { formatWhatsAppUrl } = require('./telegram-ui')
      expect(formatWhatsAppUrl('01712345678')).toBe('https://wa.me/8801712345678')
      expect(formatWhatsAppUrl('+8801712345678')).toBe('https://wa.me/8801712345678')
      expect(formatWhatsAppUrl('8801712345678')).toBe('https://wa.me/8801712345678')
    })

    it('returns null for empty phone number', () => {
      const { formatWhatsAppUrl } = require('./telegram-ui')
      expect(formatWhatsAppUrl('')).toBeNull()
      expect(formatWhatsAppUrl(null)).toBeNull()
    })
  })

  describe('control-center helpers', () => {
    it('parses order list pagination callbacks', () => {
      expect(parseListCallback('list:orders:2')).toEqual({ kind: 'orders', page: 2 })
      expect(parseListCallback('list:orders:x')).toBeNull()
    })

    it('maps AI actions to canned ops prompts', () => {
      expect(aiPromptForAction(TG_CALLBACK.AI_PROMPT_SALES)).toMatch(/today sales/i)
      expect(aiPromptForAction(TG_CALLBACK.AI_PROMPT_RISK)).toMatch(/cod risk/i)
      expect(aiPromptForAction('unknown')).toBeNull()
    })

    it('renders a premium boxed heading safely', () => {
      const html = premiumHeader('Orders Hub', 'Daily order flow')
      expect(html).toContain('<b>Orders Hub</b>')
      expect(html).toContain('Daily order flow')
    })
  })

  describe('formatNewOrderTelegramMessage history badge', () => {
    it('renders 1st order badge for new customers', () => {
      const { formatNewOrderTelegramMessage } = require('./telegram-order-message')
      const msg = formatNewOrderTelegramMessage({
        invoiceNumber: 'SPL-1001',
        total: 1500,
        subtotal: 1400,
        deliveryCharge: 100,
        discount: 0,
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        orderStatus: 'PENDING',
        shippingName: 'Rahim',
        shippingPhone: '01700000000',
        shippingAddress: 'Dhanmondi',
        shippingCity: 'Dhaka',
        isInsideDhaka: true,
        isCodRisk: false,
        siteUrl: 'https://splaro.co',
        items: [{ productName: 'Shirt', quantity: 1, price: 1400, subtotal: 1400 }],
        customerHistory: { totalOrders: 1, deliveredOrders: 0, returnedOrCancelled: 0 },
      })
      expect(msg).toContain('(1st order)')
    })

    it('renders return risk warning badge when customer has returned orders', () => {
      const { formatNewOrderTelegramMessage } = require('./telegram-order-message')
      const msg = formatNewOrderTelegramMessage({
        invoiceNumber: 'SPL-1002',
        total: 1500,
        subtotal: 1400,
        deliveryCharge: 100,
        discount: 0,
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        orderStatus: 'PENDING',
        shippingName: 'Karim',
        shippingPhone: '01800000000',
        shippingAddress: 'Chittagong',
        shippingCity: 'Chittagong',
        isInsideDhaka: false,
        isCodRisk: false,
        siteUrl: 'https://splaro.co',
        items: [{ productName: 'Shirt', quantity: 1, price: 1400, subtotal: 1400 }],
        customerHistory: { totalOrders: 3, deliveredOrders: 1, returnedOrCancelled: 2 },
      })
      expect(msg).toContain('2 returned/cancelled of 3')
    })

    it('renders Steadfast courier success score and parcel counts', () => {
      const { formatNewOrderTelegramMessage } = require('./telegram-order-message')
      const msg = formatNewOrderTelegramMessage({
        invoiceNumber: 'SPL-1003',
        total: 1500,
        subtotal: 1400,
        deliveryCharge: 100,
        discount: 0,
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        orderStatus: 'PENDING',
        shippingName: 'Sakib',
        shippingPhone: '01900000000',
        shippingAddress: 'Mirpur',
        shippingCity: 'Dhaka',
        isInsideDhaka: true,
        isCodRisk: false,
        siteUrl: 'https://splaro.co',
        items: [{ productName: 'Shirt', quantity: 1, price: 1400, subtotal: 1400 }],
        steadfastReport: { totalParcels: 10, delivered: 9, cancelled: 1, successRate: 90 },
      })
      expect(msg).toContain('Steadfast')
      expect(msg).toContain('90%')
      expect(msg).toContain('9 delivered')
    })
  })
})

