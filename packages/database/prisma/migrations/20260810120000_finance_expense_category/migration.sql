-- Finance hub: typed expense categories, payment method, packaging/fee defaults,
-- and per-order profit allocation fields. Maps legacy PartnerTransactionType
-- values on Expense.category into ExpenseCategory.

CREATE TYPE "ExpenseCategory" AS ENUM (
  'INVENTORY_PURCHASE',
  'PACKAGING',
  'COURIER',
  'ADVERTISING',
  'SALARY',
  'OFFICE',
  'ELECTRICITY',
  'INTERNET',
  'SOFTWARE',
  'EQUIPMENT',
  'PHOTOGRAPHY',
  'REFUND_LOSS',
  'RETURN_LOSS',
  'PAYMENT_FEES',
  'TAX',
  'MISC'
);

CREATE TYPE "ExpensePaymentMethod" AS ENUM (
  'CASH',
  'BANK',
  'BKASH',
  'NAGAD',
  'CARD',
  'OTHER'
);

ALTER TABLE "SiteSettings"
  ADD COLUMN "defaultPackagingCostPerOrder" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "paymentFeePercent" DECIMAL(6,3) NOT NULL DEFAULT 0;

ALTER TABLE "ProfitCalculation"
  ADD COLUMN "allocatedAdCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "incompleteReasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Expense"
  ADD COLUMN "vendor" TEXT,
  ADD COLUMN "paymentMethod" "ExpensePaymentMethod",
  ADD COLUMN "recurring" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "category_new" "ExpenseCategory";

UPDATE "Expense"
SET "category_new" = CASE "category"::text
  WHEN 'PRODUCT_COST' THEN 'INVENTORY_PURCHASE'::"ExpenseCategory"
  WHEN 'PACKAGING_COST' THEN 'PACKAGING'::"ExpenseCategory"
  WHEN 'COURIER_COST' THEN 'COURIER'::"ExpenseCategory"
  WHEN 'MARKETING_COST' THEN 'ADVERTISING'::"ExpenseCategory"
  WHEN 'OFFICE_EXPENSE' THEN 'OFFICE'::"ExpenseCategory"
  WHEN 'SALARY' THEN 'SALARY'::"ExpenseCategory"
  WHEN 'REFUND' THEN 'REFUND_LOSS'::"ExpenseCategory"
  WHEN 'RETURN_LOSS' THEN 'RETURN_LOSS'::"ExpenseCategory"
  WHEN 'SAAS_SUBSCRIPTION_COST' THEN 'SOFTWARE'::"ExpenseCategory"
  WHEN 'OTHER_EXPENSE' THEN 'MISC'::"ExpenseCategory"
  WHEN 'INVENTORY_PURCHASE' THEN 'INVENTORY_PURCHASE'::"ExpenseCategory"
  WHEN 'PACKAGING' THEN 'PACKAGING'::"ExpenseCategory"
  WHEN 'COURIER' THEN 'COURIER'::"ExpenseCategory"
  WHEN 'ADVERTISING' THEN 'ADVERTISING'::"ExpenseCategory"
  WHEN 'OFFICE' THEN 'OFFICE'::"ExpenseCategory"
  WHEN 'ELECTRICITY' THEN 'ELECTRICITY'::"ExpenseCategory"
  WHEN 'INTERNET' THEN 'INTERNET'::"ExpenseCategory"
  WHEN 'SOFTWARE' THEN 'SOFTWARE'::"ExpenseCategory"
  WHEN 'EQUIPMENT' THEN 'EQUIPMENT'::"ExpenseCategory"
  WHEN 'PHOTOGRAPHY' THEN 'PHOTOGRAPHY'::"ExpenseCategory"
  WHEN 'REFUND_LOSS' THEN 'REFUND_LOSS'::"ExpenseCategory"
  WHEN 'PAYMENT_FEES' THEN 'PAYMENT_FEES'::"ExpenseCategory"
  WHEN 'TAX' THEN 'TAX'::"ExpenseCategory"
  WHEN 'MISC' THEN 'MISC'::"ExpenseCategory"
  ELSE 'MISC'::"ExpenseCategory"
END;

ALTER TABLE "Expense" DROP COLUMN "category";
ALTER TABLE "Expense" RENAME COLUMN "category_new" TO "category";
ALTER TABLE "Expense" ALTER COLUMN "category" SET NOT NULL;
