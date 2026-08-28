import { test, expect } from '@playwright/test';

test.describe('Sidebar Component End-to-End Workflow Suite', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to a standard dashboard layout path where the sidebar is rendered
    await page.goto('/dashboard');
    await expect(page.locator('aside.app-sidebar')).toBeVisible();
  });

  test('should toggle collapse/expand states and persist layout constraints on desktop', async ({ page }) => {
    const sidebar = page.locator('aside.app-sidebar');
    const toggleBtn = sidebar.locator('.sidebar-toggle-btn');

    // Confirm default view state is expanded
    await expect(sidebar).not.toHaveClass(/sidebar-collapsed/);
    await expect(sidebar.locator('.sidebar-link-text').first()).toBeVisible();

    // Trigger collapse action
    await toggleBtn.click();

    // Verify layout classes update and text elements hide safely
    await expect(sidebar).toHaveClass(/sidebar-collapsed/);
    await expect(sidebar.locator('.sidebar-link-text').first()).not.toBeVisible();

    // Reload page to verify layout state persistence (via localStorage/cookies)
    await page.reload();
    await expect(page.locator('aside.app-sidebar')).toHaveClass(/sidebar-collapsed/);
  });

  test('should highlight active routing states and handle keyboard navigation tabs', async ({ page }) => {
    const sidebar = page.locator('aside.app-sidebar');
    const analyticsLink = sidebar.getByRole('link', { name: /analytics/i });

    // Validate active class assignment matching the current dashboard sub-route
    await analyticsLink.click();
    await expect(page).toHaveURL(/\/dashboard\/analytics/);
    await expect(analyticsLink).toHaveClass(/link-active/);

    // Verify accessibility keyboard focus sequencing using the Tab key
    await page.keyboard.press('Tab');
    const activeFocus = page.locator(':focus');
    await expect(activeFocus).toHaveAttribute('data-sidebar-interactive', 'true');
  });

  test('should manage sliding mobile overlays and auto-close drawers on narrow viewports', async ({ page }) => {
    // Downscale window viewport size to trigger mobile breakpoints
    await page.setViewportSize({ width: 375, height: 812 });

    const sidebar = page.locator('aside.app-sidebar');
    const overlayBackdrop = page.locator('.sidebar-mobile-backdrop');
    const mobileMenuTrigger = page.locator('.mobile-header-menu-btn');

    // On mobile, the sidebar drawer should start completely hidden offscreen
    await expect(sidebar).not.toBeInViewport();

    // Open mobile sidebar drawer panel
    await mobileMenuTrigger.click();
    await expect(sidebar).toBeInViewport();
    await expect(overlayBackdrop).toBeVisible();

    // Click backdrop overlay to verify auto-closing dismissal mechanics
    await overlayBackdrop.click({ force: true });
    await expect(sidebar).not.toBeInViewport();
    await expect(overlayBackdrop).not.toBeVisible();
  });
});
