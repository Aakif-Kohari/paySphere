import { test, expect } from '@playwright/test';

/**
 * ThemeToggle Workflow E2E Tests
 *
 * Issue: #1520
 *
 * Tests the application theme mode switcher:
 * 1. Authenticate and navigate to dashboard
 * 2. Verify ThemeToggle buttons and inputs exist in Navbar and Sidebar
 * 3. Toggle theme mode via Navbar button (Light <=> Dark) and assert class updates on document element
 * 4. Toggle theme mode via Sidebar checkbox and assert matching states
 * 5. Verify local storage synchronizations
 * 6. Reload page to assert theme persistence
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

test.describe('ThemeToggle Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD);
  });

  test('should render theme toggles in navbar and sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    // Navbar button toggle
    const navToggle = page.locator('button[aria-label="Toggle theme"]').first();
    await expect(navToggle).toBeVisible();

    // Sidebar checkbox toggle
    const sidebarToggle = page.locator('input[type="checkbox"][aria-label="Toggle theme"]').first();
    await expect(sidebarToggle).toBeVisible();
  });

  test('should switch theme mode and sync state across toggles', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    const navToggle = page.locator('button[aria-label="Toggle theme"]').first();
    const sidebarToggle = page.locator('input[type="checkbox"][aria-label="Toggle theme"]').first();

    // Read initial class state of html
    const isInitialDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    const initialCheckboxState = await sidebarToggle.isChecked();
    expect(isInitialDark).toBe(initialCheckboxState);

    await test.step('Toggle theme via Navbar button', async () => {
      await navToggle.click();
      await page.waitForTimeout(500);

      const isCurrentDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      expect(isCurrentDark).toBe(!isInitialDark);

      // Verify sidebar checkbox state is in sync
      const currentCheckboxState = await sidebarToggle.isChecked();
      expect(currentCheckboxState).toBe(isCurrentDark);

      // Check localStorage update
      const storedTheme = await page.evaluate(() => localStorage.getItem('themeMode'));
      expect(storedTheme).toBe(isCurrentDark ? 'dark' : 'light');
    });

    await test.step('Toggle theme back via Sidebar checkbox', async () => {
      const isCurrentDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));

      // Check or uncheck depending on state
      if (isCurrentDark) {
        await sidebarToggle.uncheck();
      } else {
        await sidebarToggle.check();
      }
      await page.waitForTimeout(500);

      const isFinalDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      expect(isFinalDark).toBe(isInitialDark);

      const finalCheckboxState = await sidebarToggle.isChecked();
      expect(finalCheckboxState).toBe(isInitialDark);
    });
  });

  test('should persist active theme choice on page reload', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    const navToggle = page.locator('button[aria-label="Toggle theme"]').first();

    // 1. Force the theme to be dark
    const isDarkBefore = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (!isDarkBefore) {
      await navToggle.click();
      await page.waitForTimeout(500);
    }

    // Assert it is dark
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);

    // 2. Reload the page
    await page.reload();
    await page.waitForTimeout(1000);

    // Assert theme state is persisted as dark
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('themeMode'))).toBe('dark');
  });
});
