import {
  formatEmailDate,
  formatEmailTaka,
  renderLineItemsBlock,
  renderTotalsBlock,
} from './email-layout.template'
import { generateProcurementEmail, type ProcurementEmailInput } from './procurement-email.template'

const base: ProcurementEmailInput = {
  kind: 'purchase-order',
  supplierName: 'Sojib Mirja',
  poNumber: 'PO-0001',
  purchasedAt: new Date('2026-08-28T10:00:00.000Z'),
  expectedAt: new Date('2026-09-03T10:00:00.000Z'),
  items: [
    { name: 'Cotton panjabi', detail: 'PNJ-001', quantity: 5, unitCost: 480, lineTotal: 2400 },
  ],
  totals: {
    subtotal: 2400,
    discount: 0,
    transportCost: 150,
    otherCost: 0,
    total: 2550,
    paidAmount: 1000,
    dueAmount: 1550,
  },
  storeName: 'SPLARO',
}

describe('formatEmailTaka', () => {
  it('groups in lakh, the way a Bangladeshi reader expects', () => {
    expect(formatEmailTaka(350000)).toBe('Tk 3,50,000.00')
  })

  it('never prints NaN for a missing or junk amount', () => {
    expect(formatEmailTaka(undefined)).toBe('Tk 0.00')
    expect(formatEmailTaka('abc')).toBe('Tk 0.00')
  })
})

describe('formatEmailDate', () => {
  it('writes a day-first date a Bangladeshi reader cannot misread as US order', () => {
    expect(formatEmailDate('2026-09-03T10:00:00.000Z')).toMatch(/^03 \w+ 2026$/)
  })

  it('prints a dash rather than "Invalid Date" for a missing or junk value', () => {
    expect(formatEmailDate(null)).toBe('—')
    expect(formatEmailDate('not-a-date')).toBe('—')
  })
})

describe('renderTotalsBlock', () => {
  it('leaves a zero discount out of the printed document', () => {
    const html = renderTotalsBlock([
      { label: 'Discount', value: 0, hideWhenZero: true },
      { label: 'Transport', value: 150, hideWhenZero: true },
    ])
    expect(html).not.toContain('Discount')
    expect(html).toContain('Transport')
  })
})

describe('renderLineItemsBlock', () => {
  it('drops the money columns when no line carries a price', () => {
    const html = renderLineItemsBlock([{ name: 'Panjabi', quantity: 5 }])
    expect(html).toContain('Qty')
    expect(html).not.toContain('Rate')
  })
})

describe('generateProcurementEmail', () => {
  it('puts the order, its money and its ETA in front of the supplier', () => {
    const mail = generateProcurementEmail(base)
    expect(mail.subject).toBe('Purchase order PO-0001 from SPLARO')
    expect(mail.html).toContain('Cotton panjabi')
    expect(mail.html).toContain('Tk 2,550.00')
    // Compared through the formatter rather than a literal: the en-GB short
    // month is "Sep" or "Sept" depending on the runtime's ICU data, and the
    // point of the assertion is that the ETA reached the document at all.
    expect(mail.html).toContain(formatEmailDate(base.expectedAt))
    expect(mail.text).toContain('Balance due: Tk 1,550.00')
  })

  it('escapes a supplier name that carries markup', () => {
    const mail = generateProcurementEmail({
      ...base,
      supplierName: '<script>alert(1)</script>',
    })
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).toContain('&lt;script&gt;')
  })

  it('says "to be confirmed" rather than inventing a date when there is no ETA', () => {
    const mail = generateProcurementEmail({ ...base, expectedAt: null })
    expect(mail.html).toContain('To be confirmed')
    expect(mail.text).toContain('to be confirmed')
  })

  it('keeps rates off the receiving note, which is only about quantities', () => {
    const mail = generateProcurementEmail({
      ...base,
      kind: 'goods-received',
      grnNumber: 'GRN-0001',
      receivedAt: new Date('2026-09-02T10:00:00.000Z'),
    })
    expect(mail.subject).toContain('Goods received against PO-0001')
    expect(mail.html).toContain('GRN-0001')
    expect(mail.html).not.toContain('Tk 480.00')
  })

  it('reports the balance still owed on a payment receipt', () => {
    const mail = generateProcurementEmail({
      ...base,
      kind: 'payment-receipt',
      payment: {
        amount: 1000,
        method: 'bKash',
        reference: 'TX1234',
        paidAt: new Date('2026-08-28T10:00:00.000Z'),
        balanceDue: 1550,
      },
    })
    expect(mail.subject).toContain('Tk 1,000.00')
    expect(mail.html).toContain('Balance still owed to you')
    expect(mail.html).toContain('Tk 1,550.00')
    expect(mail.html).toContain('bKash')
  })

  it('tells a supplier not to dispatch when the order is cancelled', () => {
    const mail = generateProcurementEmail({ ...base, kind: 'purchase-cancelled' })
    expect(mail.subject).toBe('Cancelled — purchase order PO-0001')
    expect(mail.html).toContain('do not dispatch')
    expect(mail.text).toContain('do not dispatch')
  })
})
