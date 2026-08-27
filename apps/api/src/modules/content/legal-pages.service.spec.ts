import { DEFAULT_LEGAL_PAGES, LEGAL_PAGE_SLUGS, legalPageLooksStale } from '@splaro/types'
import { rewriteStaleOrderFormat, rewriteUnconfiguredVatCopy } from './legal-pages.service'

describe('rewriteStaleOrderFormat', () => {
  it('replaces SPL-YYYY-XXXXX with SPL-####', () => {
    expect(
      rewriteStaleOrderFormat('have your order number ready (format SPL-YYYY-XXXXX).'),
    ).toBe('have your order number ready (format SPL-####).')
  })
})

describe('rewriteUnconfiguredVatCopy', () => {
  it('drops VAT-inclusive pricing claims', () => {
    expect(
      rewriteUnconfiguredVatCopy(
        'All prices are listed in Bangladeshi Taka (BDT) inclusive of applicable VAT where stated. Product images are representative.',
      ),
    ).toBe(
      'All prices are listed in Bangladeshi Taka (BDT). Product images are representative.',
    )
  })

  it('does not call an invoice a VAT invoice', () => {
    expect(
      rewriteUnconfiguredVatCopy(
        'A VAT invoice is included with every delivery and available for download.',
      ),
    ).toBe('An invoice is included with every delivery and available for download.')
  })
})

describe('DEFAULT_LEGAL_PAGES', () => {
  it('ships meta and non-empty sections on every legal page', () => {
    for (const slug of LEGAL_PAGE_SLUGS) {
      const page = DEFAULT_LEGAL_PAGES[slug]
      expect(page.metaTitle?.trim()).toBeTruthy()
      expect(page.metaDescription?.trim()).toBeTruthy()
      expect(page.sections.length).toBeGreaterThan(0)
      expect(legalPageLooksStale(page)).toBe(false)
    }
  })

  it('states COD-only checkout and ৳60 / ৳120 Steadfast shipping', () => {
    const payment = DEFAULT_LEGAL_PAGES['payment-policy'].sections.map((s) => s.body).join(' ')
    const shipping = DEFAULT_LEGAL_PAGES.shipping.sections.map((s) => s.body).join(' ')
    expect(payment).toMatch(/Cash on Delivery \(COD\) only/)
    expect(payment).not.toMatch(/accepts Cash on Delivery \(COD\), bKash/)
    expect(shipping).toMatch(/৳60 inside Dhaka/)
    expect(shipping).toMatch(/৳120 outside Dhaka/)
    expect(shipping).toMatch(/Steadfast/)
    expect(shipping).not.toMatch(/Pathao|RedX/)
    expect(DEFAULT_LEGAL_PAGES.contact.sections.some((s) => s.body.includes('SPL-####'))).toBe(true)
  })

  it('discloses Google sign-in, phone numbers, and analytics cookies on privacy', () => {
    const privacy = [
      DEFAULT_LEGAL_PAGES.privacy.description,
      ...DEFAULT_LEGAL_PAGES.privacy.sections.map((s) => `${s.heading} ${s.body}`),
    ].join('\n')
    expect(privacy).toMatch(/Google Sign-In|Google sign-in/)
    expect(privacy).toMatch(/phone number/)
    expect(privacy).toMatch(/Google Analytics/)
    expect(privacy).toMatch(/session cookie/)
    expect(privacy).toMatch(/Cash on Delivery only/)
    expect(privacy).not.toMatch(/Pathao|RedX/)
  })

  it('flags original shipped template copy as stale', () => {
    expect(
      legalPageLooksStale({
        description: 'old',
        sections: [
          {
            heading: 'Accepted methods',
            body: 'SPLARO accepts Cash on Delivery (COD), bKash, Nagad, Visa, Mastercard, and SPLARO Gift Cards.',
          },
        ],
      }),
    ).toBe(true)
  })
})
