import { test, expect } from '@playwright/test';

test.describe('Navbar Component End-to-End Workflow Suite', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to a standard landing interface path to check global mounting
    await page.goto('/');
    await expect(page.locator('nav.global-navbar')).toBeVisible();
  });

  test('should safely traverse routing navigation links on standard desktop screens', async ({ page }) => {
    const navbar = page.locator('nav.global-navbar');

    // Confirm core application identity anchors exist
    await expect(navbar.locator('.navbar-logo')).toBeVisible();
    
    // Evaluate standard routing transitions via the navigation link array
    const dashboardLink = navbar.getByRole('link', { name: /dashboard/i });
    await expect(dashboardLink).toBeVisible();
    await dashboardLink.click();
    await expect(page).toHaveURL(/\/dashboard/);

    const profileLink = navbar.getByRole('link', { name: /profile/i });
    await profileLink.click();
    await expect(page).toHaveURL(/\/profile/);
  });

  test('should render responsive navigation structures and toggle hamburger actions on mobile', async ({ page }) => {
    // Force viewport layout configurations down to a standard mobile width profile
    await page.setViewportSize({ width: 375, height: 667 });

    const navbar = page.locator('nav.global-navbar');
    const mobileMenuBtn = navbar.getByRole('button', { name: /toggle menu/i });
    const mobileMenuContent = navbar.locator('.navbar-mobile-menu');

    // Verify links collapse into the hamburger icon structure automatically on thin viewports
    await expect(mobileMenuBtn).toBeVisible();
    await expect(mobileMenuContent).not.toBeVisible();

    // Click icon to verify sliding/opening transition behaviors
    await mobileMenuBtn.click();
    await expect(mobileMenuContent).toBeVisible();

    // Validate a sub-link option functions correctly within the mobile drawer
    await mobileMenuContent.getByRole('link', { name: /settings/i }).click();
    await expect(page).toHaveURL(/\/settings/);
    
    // Verify menu closes automatically post-navigation anchor click
    await expect(mobileMenuContent).not.toBeVisible();
  });

  test('should smoothly toggle the user authorization session dropdown matrix and process sign out', async ({ page }) => {
    const navbar = page.locator('nav.global-navbar');
    const profileDropdownTrigger = navbar.locator('.profile-dropdown-trigger');
    const dropdownMenu = navbar.locator('.profile-dropdown-menu');

    // Confirm setup details start cleanly isolated/hidden
    await expect(profileDropdownTrigger).toBeVisible();
    await expect(dropdownMenu).not.toBeVisible();

    // Open user session context drawer matrix panel
    await profileDropdownTrigger.click();
    await expect(dropdownMenu).toBeVisible();

    // Validate presence of accessibility structural attributes
    await expect(profileDropdownTrigger).toHaveAttribute('aria-expanded', 'true');

    // Execute mock account log out termination click handler
    await dropdownMenu.getByRole('button', { name: /sign out/i }).click();

    // Verify context system routes user to unauthenticated splash tracking interfaces
    await expect(page).toHaveURL(/\/login/);
    await expect(navbar.locator('.profile-dropdown-trigger')).not.toBeVisible();
    await expect(navbar.getByRole('button', { name: /sign in/i })).toBeVisible();
  });
});
