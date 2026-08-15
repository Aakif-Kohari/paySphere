import { test, expect } from '@playwright/test';

/**
 * Payroll Approval E2E Test
 * 
 * Issue: #518
 * 
 * Tests the critical path of approving a pending payroll:
 * 1. Login to the application
 * 2. Navigate to Settings -> Payroll
 * 3. Find and approve a pending payroll
 * 4. Verify success message appears
 * 
 * Prerequisites:
 * - Test user credentials must be configured in environment variables
 * - At least one pending payroll must exist in the test database
 */

test.describe('Payroll Approval Workflow', () => {

    // Test configuration
    const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
    const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword';

    test.beforeEach(async ({ page }) => {
        // Navigate to login page
        await page.goto('/auth');

        // Wait for login form to be visible
        await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    });

    test('should login, navigate to payroll, approve pending payroll, and verify success', async ({ page }) => {
        // Step 1: Login
        await test.step('Login with test credentials', async () => {
            // Fill in email
            await page.fill('input[type="email"]', TEST_EMAIL);

            // Fill in password
            await page.fill('input[type="password"]', TEST_PASSWORD);

            // Click login button
            await page.click('button[type="submit"]');

            // Wait for successful redirect to dashboard
            await page.waitForURL('**/dashboard', { timeout: 15000 });

            // Verify we're on the dashboard
            await expect(page).toHaveURL(/dashboard/);
        });

        // Step 2: Navigate to Settings -> Payroll
        await test.step('Navigate to Settings', async () => {
            // Click on Settings in sidebar (look for the settings link)
            // The sidebar contains navigation links
            await page.click('a[href="/settings"]');

            // Wait for settings page to load
            await page.waitForURL('**/settings', { timeout: 10000 });

            // Verify we're on settings page
            await expect(page).toHaveURL(/settings/);
        });

        // Step 3: Navigate to Payroll tab within Settings
        await test.step('Navigate to Payroll tab', async () => {
            // Look for Payroll tab in settings
            // Based on the Settings.jsx structure, there's a "Payroll Config" tab
            await page.click('text=Payroll Config');

            // Wait for payroll config section to be visible
            await page.waitForSelector('text=Payroll Config', { timeout: 5000 });
        });

        // Step 4: Navigate to Approvals page
        await test.step('Navigate to Approvals page', async () => {
            // Navigate to approvals page
            await page.goto('/approvals');

            // Wait for approvals page to load
            await page.waitForURL('**/approvals', { timeout: 10000 });

            // Verify we're on approvals page
            await expect(page).toHaveURL(/approvals/);
        });

        // Step 5: Find and approve a pending payroll
        await test.step('Approve pending payroll', async () => {
            // Wait for the approvals table to load
            await page.waitForSelector('table, [role="table"]', { timeout: 10000 });

            // Look for pending payroll entries
            // Check if there are any pending approvals
            const pendingRows = await page.locator('tr, [role="row"]').filter({ hasText: /pending|PENDING/i }).count();

            if (pendingRows === 0) {
                // If no pending payrolls, skip the test with a message
                test.skip(true, 'No pending payrolls found to approve. Test requires at least one pending payroll.');
                return;
            }

            // Click the first approve button
            // Look for buttons with text "Approve" or similar
            const approveButton = page.locator('button').filter({ hasText: /approve/i }).first();
            await approveButton.click();

            // Wait for approval to complete
            await page.waitForTimeout(2000);
        });

        // Step 6: Verify success message
        await test.step('Verify success message', async () => {
            // Look for success snackbar/alert
            // Based on the codebase, success messages use MUI Snackbar with Alert
            const successMessage = page.locator('[role="alert"]').filter({ hasText: /approved|success/i });

            // Wait for success message to appear
            await expect(successMessage).toBeVisible({ timeout: 10000 });

            // Verify the message contains success text
            await expect(successMessage).toContainText(/approved|success/i);
        });

        // Step 7: Verify payroll status changed
        await test.step('Verify payroll status updated', async () => {
            // Reload the page to get fresh data
            await page.reload();

            // Wait for table to reload
            await page.waitForSelector('table, [role="table"]', { timeout: 10000 });

            // The approved payroll should no longer be in pending status
            // or should show "approved" status
            const approvedPayroll = page.locator('tr, [role="row"]').filter({ hasText: /approved|APPROVED/i });

            // At least one approved payroll should exist
            await expect(approvedPayroll.first()).toBeVisible({ timeout: 5000 });
        });
    });

    test('should handle empty pending payrolls gracefully', async ({ page }) => {
        // Login
        await page.fill('input[type="email"]', TEST_EMAIL);
        await page.fill('input[type="password"]', TEST_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL('**/dashboard', { timeout: 15000 });

        // Navigate to approvals
        await page.goto('/approvals');
        await page.waitForURL('**/approvals', { timeout: 10000 });

        // Check if there's an empty state message
        const emptyState = page.locator('text=/no pending|no payroll|empty/i');

        // Either there are pending payrolls or an empty state message
        const hasPendingOrEmpty = await emptyState.or(page.locator('table, [role="table"]')).count();
        expect(hasPendingOrEmpty).toBeGreaterThan(0);
    });

    test('should require authentication to access approvals', async ({ page }) => {
        // Try to access approvals without logging in
        await page.goto('/approvals');

        // Should redirect to auth page
        await page.waitForURL('**/auth', { timeout: 10000 });

        // Verify we're on the auth page
        await expect(page).toHaveURL(/auth/);
    });
});
