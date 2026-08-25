import { test, expect } from '@playwright/test';

/**
 * AssetCard Workflow E2E Tests
 *
 * Issue: #1519
 *
 * Tests the complete hardware asset management lifecycle:
 * 1. Authenticate and navigate to asset inventory dashboard
 * 2. Verify AssetCard rendering (title, badges, layout, metadata)
 * 3. Inspect asset details modal (trigger modal on click, verify fields, close modal)
 * 4. Search and filter assets dynamically
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

test.describe('AssetCard Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD);
  });

  test('should render asset cards with correct details', async ({ page }) => {
    await test.step('Navigate to Asset Inventory page', async () => {
      await page.goto('/enterprise/asset-inventory');
      await page.waitForTimeout(1000);
    });

    await test.step('Verify asset cards are visible', async () => {
      const cards = page.locator('[data-testid="asset-card"]');
      await expect(cards.first()).toBeVisible({ timeout: 10_000 });
      expect(await cards.count()).toBeGreaterThan(0);
    });

    await test.step('Verify layout elements of a card', async () => {
      const firstCard = page.locator('[data-testid="asset-card"]').first();
      await expect(firstCard.locator('h3')).toContainText(/MacBook|Dell|iPhone|ThinkPad|iPad/i);
      await expect(firstCard).toContainText(/VALUE/i);
      await expect(firstCard).toContainText(/CONDITION/i);
      await expect(firstCard).toContainText(/ASSIGNEE/i);
    });
  });

  test('should support inspecting asset details in a modal', async ({ page }) => {
    await page.goto('/enterprise/asset-inventory');
    await page.waitForTimeout(1000);

    const firstCard = page.locator('[data-testid="asset-card"]').first();
    const assetTitle = await firstCard.locator('h3').innerText();

    await test.step('Click first asset card to open details modal', async () => {
      await firstCard.click();
      await page.waitForTimeout(500);
    });

    await test.step('Verify modal content and close it', async () => {
      const modal = page.locator('div[style*="position: fixed"]').first();
      await expect(modal).toBeVisible();
      await expect(modal.locator('h2')).toContainText(new RegExp(assetTitle, 'i'));

      // Close the modal
      const closeBtn = modal.locator('button:has-text("Close")');
      await closeBtn.click();
      await page.waitForTimeout(500);
      await expect(modal).not.toBeVisible();
    });
  });

  test('should filter asset cards dynamically by search input', async ({ page }) => {
    await page.goto('/enterprise/asset-inventory');
    await page.waitForTimeout(1000);

    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible();

    await test.step('Filter by keyword "ThinkPad"', async () => {
      await searchInput.fill('ThinkPad');
      await page.waitForTimeout(500);

      const visibleCards = page.locator('[data-testid="asset-card"]');
      expect(await visibleCards.count()).toBe(1);
      await expect(visibleCards.first()).toContainText('ThinkPad');
    });

    await test.step('Reset filter', async () => {
      await searchInput.fill('');
      await page.waitForTimeout(500);

      const visibleCards = page.locator('[data-testid="asset-card"]');
      expect(await visibleCards.count()).toBeGreaterThan(1);
    });
  });
});
