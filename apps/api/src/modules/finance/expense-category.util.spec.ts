import { expenseCategoryToPartnerType, parseExpenseCategory } from './expense-category.util'

describe('parseExpenseCategory', () => {
  it('accepts new V1 categories', () => {
    expect(parseExpenseCategory('ADVERTISING')).toBe('ADVERTISING')
    expect(parseExpenseCategory('misc')).toBe('MISC')
  })

  it('maps legacy PartnerTransactionType names', () => {
    expect(parseExpenseCategory('PRODUCT_COST')).toBe('INVENTORY_PURCHASE')
    expect(parseExpenseCategory('MARKETING_COST')).toBe('ADVERTISING')
    expect(parseExpenseCategory('PACKAGING_COST')).toBe('PACKAGING')
    expect(parseExpenseCategory('OTHER_EXPENSE')).toBe('MISC')
  })

  it('rejects unknown categories for create validation', () => {
    expect(parseExpenseCategory('NOT_A_CATEGORY')).toBeNull()
    expect(parseExpenseCategory('')).toBeNull()
  })
})

describe('expenseCategoryToPartnerType', () => {
  it('keeps Partner Hub ledger types working', () => {
    expect(expenseCategoryToPartnerType('ADVERTISING')).toBe('MARKETING_COST')
    expect(expenseCategoryToPartnerType('INVENTORY_PURCHASE')).toBe('PRODUCT_COST')
    expect(expenseCategoryToPartnerType('MISC')).toBe('OTHER_EXPENSE')
  })
})
