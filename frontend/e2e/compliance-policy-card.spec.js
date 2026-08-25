import { test, expect } from '@playwright/test';

/**
 * CompliancePolicyCard Workflow E2E Tests
 *
 * Issue: #1518
 *
 * Tests the complete compliance policy lifecycle:
 * 1. Authenticate and navigate to compliance dashboard
 * 2. Verify CompliancePolicyCard rendering (title, badges, progress, metadata)
 * 3. Inspect policy details modal (onView callback)
 * 4. Sign policy / mandatory acknowledgment (onAcknowledge callback & state changes)
 * 5. Verify conditional action buttons (no sign button if mandatory is false)
 * 6. Search and filter policies dynamically
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

test.describe('CompliancePolicyCard Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD);
  });

  test('should render compliance policy cards with correct details', async ({ page }) => {
    await test.step('Navigate to Compliance page', async () => {
      await page.goto('/enterprise/compliance-audit');
      await page.waitForTimeout(1000);
    });

    await test.step('Verify compliance policy cards are visible', async () => {
      const cards = page.locator('[data-testid="compliance-policy-card"]');
      await expect(cards.first()).toBeVisible({ timeout: 10_000 });
      expect(await cards.count()).toBeGreaterThan(0);
    });

    await test.step('Verify card elements', async () => {
      const firstCard = page.locator('[data-testid="compliance-policy-card"]').first();
      await expect(firstCard.locator('h3')).toContainText(/GDPR|FLSA|ISO/i);
      await expect(firstCard).toContainText(/Jurisdiction/i);
      await expect(firstCard).toContainText(/Effective Date/i);
    });
  });

  test('should support inspecting policy details in modal', async ({ page }) => {
    await page.goto('/enterprise/compliance-audit');
    await page.waitForTimeout(1000);

    await test.step('Click Inspect button on first card', async () => {
      const inspectBtn = page.locator('[data-testid="compliance-policy-card"] button:has-text("Inspect")').first();
      await inspectBtn.click();
      await page.waitForTimeout(500);
    });

    await test.step('Verify modal content and close it', async () => {
      const modal = page.locator('div[style*="position: fixed"]').first();
      await expect(modal).toBeVisible();
      await expect(modal).toContainText(/Details/i);

      // Close the modal
      const closeBtn = modal.locator('button:has-text("Close")');
      await closeBtn.click();
      await page.waitForTimeout(500);
      await expect(modal).not.toBeVisible();
    });
  });

  test('should support signing policy with updated acknowledgement counts', async ({ page }) => {
    await page.goto('/enterprise/compliance-audit');
    await page.waitForTimeout(1000);

    const card = page.locator('[data-testid="compliance-policy-card"]', { hasText: 'Global GDPR Privacy Framework' });
    await expect(card).toBeVisible();

    await test.step('Verify initial signed count', async () => {
      await expect(card).toContainText('384 signed');
    });

    await test.step('Sign policy and verify updated acknowledgement count', async () => {
      const signBtn = card.locator('button:has-text("Sign Policy")');
      await signBtn.click();
      await page.waitForTimeout(500);
      await expect(card).toContainText('385 signed');
    });

    await test.step('Verify non-mandatory policy does not display sign button', async () => {
      const nonMandatoryCard = page.locator('[data-testid="compliance-policy-card"]', { hasText: 'Fair Labor Standards Act (FLSA)' });
      await expect(nonMandatoryCard.locator('button:has-text("Sign Policy")')).not.toBeVisible();
    });
  });

  test('should filter compliance cards dynamically by search input', async ({ page }) => {
    await page.goto('/enterprise/compliance-audit');
    await page.waitForTimeout(1000);

    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible();

    await test.step('Filter by keyword "GDPR"', async () => {
      await searchInput.fill('GDPR');
      await page.waitForTimeout(500);

      const visibleCards = page.locator('[data-testid="compliance-policy-card"]');
      expect(await visibleCards.count()).toBe(1);
      await expect(visibleCards.first()).toContainText('GDPR');
    });

    await test.step('Reset filter', async () => {
      await searchInput.fill('');
      await page.waitForTimeout(500);

      const visibleCards = page.locator('[data-testid="compliance-policy-card"]');
      expect(await visibleCards.count()).toBeGreaterThan(1);
    });
  });
});
