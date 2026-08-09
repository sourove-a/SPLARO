-- Recreate Expense(storeId, category) after the enum column swap dropped it.
CREATE INDEX IF NOT EXISTS "Expense_storeId_category_idx" ON "Expense"("storeId", "category");
