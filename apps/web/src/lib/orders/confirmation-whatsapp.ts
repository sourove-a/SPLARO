import { displayOrderCode } from '@splaro/config'
import type { StoredOrder } from '@/lib/orders'

function formatTaka(amount: number | string | undefined | null): string {
  if (amount === null || amount === undefined) return '৳0'
  const num = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.]/g, '')) : amount
  if (isNaN(num)) return '৳0'
  return `৳${num.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function cleanDeliveryAddress(address?: string, city?: string): string {
  const addr = (address || '').trim()
  const cty = (city || '').trim()
  if (!addr && !cty) return ''
  if (!cty) return addr
  if (!addr) return cty
  if (
    addr.toLowerCase().endsWith(cty.toLowerCase()) ||
    addr.toLowerCase().includes(`, ${cty.toLowerCase()}`) ||
    addr.toLowerCase().includes(`,${cty.toLowerCase()}`)
  ) {
    return addr
  }
  return `${addr}, ${cty}`
}

function formatPaymentLabel(value: string | undefined): string {
  const val = (value || '').toLowerCase().trim()
  if (val === 'cod' || val === 'cash_on_delivery') return 'Cash on Delivery (ক্যাশ অন ডেলিভারি)'
  if (val === 'bkash') return 'bKash (বিকাশ)'
  if (val === 'nagad') return 'Nagad (নগদ)'
  if (val === 'sslcommerz') return 'Card / Online Payment (অনলাইন পেমেন্ট)'
  return value?.trim() || 'Cash on Delivery'
}

function formatVariantInfo(size: string | undefined): string {
  if (!size || !size.trim()) return ''
  const trimmed = size.trim()
  if (trimmed.toLowerCase() === 'onesize' || trimmed.toLowerCase() === 'free size') {
    return 'Free Size'
  }
  if (/^(xs|s|m|l|xl|xxl|2xl|3xl|4xl|\d{2,3})$/i.test(trimmed)) {
    return `সাইজ: ${trimmed.toUpperCase()}`
  }
  return `কালার/ভ্যারিয়েন্ট: ${trimmed}`
}

export function buildOrderConfirmationWhatsAppMessage(order: StoredOrder): string {
  const name = order.customer.name?.trim() || 'Customer'
  const rawCode = displayOrderCode(order.invoiceNumber ?? order.id, order.id).replace(/^#/, '')
  const orderCode = `#${rawCode}`
  const phone = order.customer.phone?.trim()
  const address = cleanDeliveryAddress(order.customer.address, order.customer.city)
  const payment = formatPaymentLabel(order.customer.payment)

  const itemSections = order.items.map((item, index) => {
    const variant = formatVariantInfo(item.size)
    const variantLine = variant ? `   • ${variant}` : ''
    const lines = [
      `${index + 1}. *${item.name}*`,
      variantLine,
      `   • পরিমাণ: ${item.quantity}টি | মূল্য: ${formatTaka(item.price * item.quantity)}`,
    ].filter(Boolean)
    return lines.join('\n')
  })

  const billLines = [
    `• পণ্যের সাবটোটাল: ${formatTaka(order.subtotal || order.total - (order.delivery || 0))}`,
    order.delivery > 0 ? `• ডেলিভারি চার্জ: ${formatTaka(order.delivery)}` : '• ডেলিভারি চার্জ: ফ্রি (Free)',
    order.discount > 0 ? `• বিশেষ ছাড় (Discount): -${formatTaka(order.discount)}` : '',
    `• *সর্বমোট প্রদেয় বিল:* *${formatTaka(order.total)}*`,
  ].filter(Boolean)

  return [
    '*SPLARO | Order Confirmation*',
    '━━━━━━━━━━━━━━━━━━━━',
    `আমি *${name}*। SPLARO-তে একটি নতুন অর্ডার করেছি এবং অর্ডারটি কনফার্ম (Confirm) করতে চাচ্ছি।`,
    '',
    '*অর্ডারের বিবরণ:*',
    `• *অর্ডার কোড:* *${orderCode}*`,
    `• *গ্রাহকের নাম:* ${name}`,
    phone ? `• *মোবাইল নম্বর:* ${phone}` : '',
    address ? `• *ডেলিভারি ঠিকানা:* ${address}` : '',
    '',
    '*অর্ডারকৃত পণ্য:*',
    ...itemSections,
    '',
    '*পেমেন্ট ও বিল:*',
    `• *পেমেন্ট মেথড:* ${payment}`,
    ...billLines,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    'দয়া করে দ্রুত অর্ডারটি কনফার্ম করে ডেলিভারির ব্যবস্থা করুন। ধন্যবাদ — *SPLARO*',
  ]
    .filter(Boolean)
    .join('\n')
}
