-- Prevent concurrent or duplicate decisions at the same approval level.
CREATE UNIQUE INDEX "ExpenseApproval_expenseId_level_key" ON "ExpenseApproval"("expenseId", "level");
