import { test, expect } from '@playwright/test';

/**
 * User Authentication E2E Tests
 *
 * Issue: #1041
 *
 * Tests the login and sign-up flows for PaySphere:
 * 1. Login with valid credentials → redirect to /dashboard
 * 2. Login with wrong password → error message shown
 * 3. Login and logout → redirected back to /auth
 * 4. Protected routes redirect unauthenticated users to /auth
 *
 * Prerequisites:
 * - TEST_USER_EMAIL / TEST_USER_PASSWORD environment variables must be set.
 * - The backend and frontend dev servers must be running.
 */

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fills in email + password on the login form and submits.
 * Assumes the page is already at /auth with the login tab active.
 */
async function fillAndSubmitLogin(page, email, password) {
    await page.fill('#login-email', email);
    await page.fill('#login-password', password);
    await page.click('button[type="submit"]');
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

test.describe('User Authentication', () => {

    test.beforeEach(async ({ page }) => {
        // Navigate to the auth page before every test
        await page.goto('/auth');
        // Wait until the login email input is visible (login tab is default)
        await page.waitForSelector('#login-email', { timeout: 10_000 });
    });

    // ── 1. Successful Login ────────────────────────────────────────────────
    test('should login with valid credentials and redirect to /dashboard', async ({ page }) => {
        await test.step('Fill in credentials and submit', async () => {
            await fillAndSubmitLogin(page, TEST_EMAIL, TEST_PASSWORD);
        });

        await test.step('Verify redirect to /dashboard', async () => {
            await page.waitForURL('**/dashboard', { timeout: 15_000 });
            await expect(page).toHaveURL(/dashboard/);
        });
    });

    // ── 2. Wrong Password → Error Message ─────────────────────────────────
    test('should show an error message for an incorrect password', async ({ page }) => {
        await test.step('Submit with wrong password', async () => {
            await fillAndSubmitLogin(page, TEST_EMAIL, 'WrongPassword!');
        });

        await test.step('Verify error message is visible', async () => {
            // LoginSignUp.jsx renders errors in <p className="text-red-500 ...">
            const errorMsg = page.locator('p.text-red-500, [role="alert"]');
            await expect(errorMsg.first()).toBeVisible({ timeout: 8_000 });
            await expect(errorMsg.first()).toContainText(/invalid|error|incorrect|password/i);
        });
    });

    // ── 3. Login → Logout ─────────────────────────────────────────────────
    test('should login and then logout successfully', async ({ page }) => {
        await test.step('Login', async () => {
            await fillAndSubmitLogin(page, TEST_EMAIL, TEST_PASSWORD);
            await page.waitForURL('**/dashboard', { timeout: 15_000 });
            await expect(page).toHaveURL(/dashboard/);
        });

        await test.step('Click logout button', async () => {
            const logoutBtn = page
                .locator('button, a')
                .filter({ hasText: /logout|sign out/i })
                .first();
            await logoutBtn.waitFor({ timeout: 8_000 });
            await logoutBtn.click();
        });

        await test.step('Verify redirect back to /auth', async () => {
            await page.waitForURL('**/auth', { timeout: 10_000 });
            await expect(page).toHaveURL(/auth/);
        });
    });

    // ── 4. Protected Route Redirect ────────────────────────────────────────
    test('should redirect unauthenticated users from /dashboard to /auth', async ({ page }) => {
        // Navigate directly to a protected route without logging in
        await page.goto('/dashboard');

        // ProtectedRoute component should push the user to /auth
        await page.waitForURL('**/auth', { timeout: 10_000 });
        await expect(page).toHaveURL(/auth/);
    });
});