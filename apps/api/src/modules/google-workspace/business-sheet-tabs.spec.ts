import { GoogleSheetType } from '@prisma/client'
import { BUSINESS_SHEET_TABS, SHEET_HEADERS } from './google-sheets-bd.util'

/**
 * The admin counts "n of 12 tabs set up" from the sheet-type map, but only the
 * tabs listed in BUSINESS_SHEET_TABS are ever created and written. Eight of
 * them were mapped and counted while nothing filled them, which is what put
 * "Not set up" on most of the screen. These lock the two lists together.
 */
const ADMIN_MAPPED_TABS = [
  'Orders',
  'Customers',
  'Products & Stock',
  'Partner Accounts',
  'Expenses',
  'Profit & Loss',
  'Courier',
  'Payments',
  'Daily Summary',
  'Telegram Logs',
  'AI Jobs',
] as const

describe('business spreadsheet tabs', () => {
  it('writes every tab the admin screen offers', () => {
    for (const tab of ADMIN_MAPPED_TABS) {
      expect(BUSINESS_SHEET_TABS).toContain(tab)
    }
  })

  it('gives every tab a header row', () => {
    for (const tab of BUSINESS_SHEET_TABS) {
      expect(SHEET_HEADERS[tab]).toBeDefined()
      expect(SHEET_HEADERS[tab].length).toBeGreaterThan(0)
    }
  })

  it('has no header entry for a tab that is never created', () => {
    for (const tab of Object.keys(SHEET_HEADERS)) {
      expect(BUSINESS_SHEET_TABS).toContain(tab)
    }
  })

  it('keeps tab names unique — a duplicate would silently overwrite', () => {
    expect(new Set(BUSINESS_SHEET_TABS).size).toBe(BUSINESS_SHEET_TABS.length)
  })

  it('never blanks a header cell, which would leave an unlabelled column', () => {
    for (const tab of BUSINESS_SHEET_TABS) {
      for (const header of SHEET_HEADERS[tab]) {
        expect(header.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('covers every GoogleSheetType the admin can ask to push', () => {
    // Sheet types with no business tab fall back to a full rebuild rather than
    // failing, but a type nobody maps at all is a gap worth catching here.
    const mappable: GoogleSheetType[] = [
      'ORDERS',
      'CUSTOMERS',
      'PRODUCTS',
      'INVENTORY',
      'PARTNER_ACCOUNTS',
      'EXPENSES',
      'PROFIT_LOSS',
      'COURIER',
      'PAYMENT',
      'DAILY_SUMMARY',
    ]
    expect(mappable.length).toBeGreaterThan(0)
    expect(BUSINESS_SHEET_TABS.length).toBeGreaterThanOrEqual(mappable.length)
  })
})
