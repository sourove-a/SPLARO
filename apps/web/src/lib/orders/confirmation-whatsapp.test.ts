import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildOrderConfirmationWhatsAppMessage } from './confirmation-whatsapp'

describe('order confirmation WhatsApp message', () => {
  it('includes the customer, order, line details, and totals', () => {
    const message = buildOrderConfirmationWhatsAppMessage({
      id: 'order-1',
      invoiceNumber: 'SPL-1001',
      createdAt: '2026-09-01T00:00:00.000Z',
      customer: {
        name: 'Rahim Ahmed',
        email: 'rahim@example.com',
        phone: '01700000000',
        address: 'House 84, Road 12, Sector 13, Uttara, Dhaka',
        city: 'Dhaka',
        payment: 'Cash on Delivery',
      },
      items: [{
        productId: 'product-1',
        variantId: 'variant-1',
        quantity: 2,
        name: 'Premium Polo',
        price: 1200,
        image: '/polo.webp',
        size: 'M',
        slug: 'premium-polo',
      }],
      subtotal: 2400,
      delivery: 60,
      discount: 0,
      total: 2460,
    })

    assert.match(message, /Rahim Ahmed/)
    assert.match(message, /SPL-1001/)
    assert.match(message, /Premium Polo/)
    assert.match(message, /2টি/)
    assert.match(message, /2,460/)
    assert.match(message, /SPLARO \| Order Confirmation/)
    assert.doesNotMatch(message, /Dhaka,\s*Dhaka/i)
  })
})
