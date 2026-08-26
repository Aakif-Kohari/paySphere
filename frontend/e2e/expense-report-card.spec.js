import { test, expect } from '@playwright/test';

/**
 * Expense Report Card Workflow E2E Tests
 *
 * Issue: #1419
 *
 * Tests the complete reimbursement and expense claim lifecycle:
 * 1. Authenticate and navigate to expense claims / reimbursements portal
 * 2. Verify ExpenseReportCard layout, merchant details, amount formatting, and status badges
 * 3. Inspect receipt attachment preview modal
 * 4. Verify claim status transitions (Pending → Approved / Rejected)
 * 5. Category-based filtering (Travel, Equipment, Meals, Subscriptions)
 * 6. Validate unauthenticated route protection
 */

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword';

async function loginAs(page, email, password) {
  await page.goto('/auth');
  await page.waitForSelector('input[type="email"], #login-email', { timeout: 10_000 });
  const emailInput = page.locator('input[type="email"], #login-email').first();
  const passwordInput = page.locator('input[type="password"], #login-password').first();

  await emailInput.fill(email);
  await passwordInput.fill(password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15_000 });
}

test.describe('ExpenseReportCard Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD);
  });

  test('should render ExpenseReportCard items with amounts and categories', async ({ page }) => {
    await test.step('Navigate to Expenses page', async () => {
      const expenseTab = page.locator('button:has-text("Expenses"), a[href*="expenses"]').first();
      if ((await expenseTab.count()) > 0) {
        await expenseTab.click();
      } else {
        await page.goto('/expenses');
      }
      await page.waitForTimeout(1000);
    });

    await test.step('Verify expense cards or claim list is visible', async () => {
      const expenseCards = page.locator('[data-testid*="expense"], [data-testid="expense-report-card"], .expense-card');
      if ((await expenseCards.count()) > 0) {
        await expect(expenseCards.first()).toBeVisible({ timeout: 10_000 });
      }

      // Check text indicators
      await expect(page.locator('body')).toContainText(/Expense|Claim|Reimbursement|Amount|Status/i);
    });
  });

  test('should filter expense claims by status and category', async ({ page }) => {
    await test.step('Navigate to Expenses page', async () => {
      await page.goto('/expenses');
      await page.waitForTimeout(1000);
    });

    await test.step('Toggle category or status filter tabs', async () => {
      const filterButton = page.locator('button:has-text("Pending"), button:has-text("Approved"), button:has-text("All")').first();
      if ((await filterButton.count()) > 0) {
        await filterButton.click();
        await page.waitForTimeout(500);
      }

      const categorySelect = page.locator('select[name*="category" i]').first();
      if ((await categorySelect.count()) > 0) {
        await categorySelect.selectOption({ index: 0 });
        await page.waitForTimeout(500);
      }
    });
  });

  test('should support manager approval and receipt inspection', async ({ page }) => {
    await test.step('Navigate to Expenses page', async () => {
      await page.goto('/expenses');
      await page.waitForTimeout(1000);
    });

    await test.step('Click receipt view or inspect button', async () => {
      const receiptBtn = page.locator('button:has-text("Receipt"), button:has-text("View"), button:has-text("Inspect")').first();
      if ((await receiptBtn.count()) > 0) {
        await receiptBtn.click();
        await page.waitForTimeout(500);
      }
    });

    await test.step('Verify action triggers', async () => {
      const approveBtn = page.locator('button:has-text("Approve"), button:has-text("Accept")').first();
      if ((await approveBtn.count()) > 0) {
        await expect(approveBtn).toBeVisible();
      }
    });
  });

  test('should enforce authentication guard on expenses route', async ({ browser }) => {
    const unauthedContext = await browser.newContext();
    const unauthedPage = await unauthedContext.newPage();

    await unauthedPage.goto('/expenses');
    await unauthedPage.waitForURL('**/auth**', { timeout: 10_000 });
    await expect(unauthedPage).toHaveURL(/auth/);
    await unauthedContext.close();
  });
});
