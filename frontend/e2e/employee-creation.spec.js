import { test, expect } from '@playwright/test';

/**
 * Employee Creation E2E Tests
 *
 * Issue: #1041
 *
 * Tests the end-to-end employee creation flow for PaySphere:
 * 1. Login → navigate to /add-employee → fill in the EmployeeForm → submit
 *    → confirm redirect to /dashboard?tab=employees
 * 2. Validate that required-field errors appear when the form is submitted empty
 * 3. Confirm that unauthenticated users are redirected away from /add-employee
 *
 * Prerequisites:
 * - TEST_USER_EMAIL / TEST_USER_PASSWORD environment variables must be set
 *   with credentials for a valid test account.
 * - The backend and frontend dev servers must be running.
 *
 * Form field IDs are derived from EmployeeForm.jsx where Formik <Field>
 * components receive an `id` equal to the field `name` prop.
 */

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Logs in via the /auth page and waits for /dashboard to load.
 */
async function loginAs(page, email, password) {
    await page.goto('/auth');
    await page.waitForSelector('#login-email', { timeout: 10_000 });
    await page.fill('#login-email', email);
    await page.fill('#login-password', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15_000 });
}

/**
 * Generates a unique employee name to avoid collisions between test runs.
 */
function uniqueEmployeeName() {
    return `E2E Employee ${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

test.describe('Employee Creation Flow', () => {

    // ── 1. Happy Path – Create an Employee ───────────────────────────────────
    test('should login, fill in employee form, and submit successfully', async ({ page }) => {
        await test.step('Login as test user', async () => {
            await loginAs(page, TEST_EMAIL, TEST_PASSWORD);
        });

        await test.step('Navigate to /add-employee', async () => {
            // Try the sidebar link first; fall back to direct navigation
            const addLink = page.locator('a[href="/add-employee"]');
            if (await addLink.count() > 0) {
                await addLink.first().click();
            } else {
                await page.goto('/add-employee');
            }
            await page.waitForURL('**/add-employee', { timeout: 10_000 });
            await expect(page).toHaveURL(/add-employee/);
        });

        await test.step('Fill in the Personal Information section', async () => {
            // Wait for the form's first required field to be ready
            await page.waitForSelector('#fullName', { timeout: 8_000 });

            await page.fill('#fullName', uniqueEmployeeName());
            await page.fill('#email', `employee_${Date.now()}@example.com`);
            // Optional date fields – leave blank to keep test fast
        });

        await test.step('Fill in the Employment Details section', async () => {
            await page.fill('#role', 'QA Engineer');
            await page.fill('#department', 'Engineering');
            // Currency defaults to INR – no change needed
        });

        await test.step('Fill in the Compensation section', async () => {
            await page.fill('#monthlySalary', '60000');
            // overtimeRate is optional – skip
        });

        await test.step('Submit the form', async () => {
            // Click the "Save Employee" submit button
            const submitBtn = page.locator('button[type="submit"]').filter({ hasText: /save employee/i });
            await submitBtn.click();
        });

        await test.step('Verify redirect to dashboard employees tab', async () => {
            // AddEmployee.jsx calls navigate('/dashboard?tab=employees') on success
            await page.waitForURL('**/dashboard**', { timeout: 20_000 });
            await expect(page).toHaveURL(/dashboard/);
        });
    });

    // ── 2. Validation – Required Fields ──────────────────────────────────────
    test('should show validation errors when submitting an empty form', async ({ page }) => {
        await test.step('Login', async () => {
            await loginAs(page, TEST_EMAIL, TEST_PASSWORD);
        });

        await test.step('Navigate to /add-employee', async () => {
            await page.goto('/add-employee');
            await page.waitForURL('**/add-employee', { timeout: 10_000 });
        });

        await test.step('Submit the form without filling any fields', async () => {
            await page.waitForSelector('#fullName', { timeout: 8_000 });
            const submitBtn = page.locator('button[type="submit"]').filter({ hasText: /save employee/i });
            await submitBtn.click();
        });

        await test.step('Verify required-field validation errors appear', async () => {
            // Formik + Yup renders inline errors via <ErrorMessage> with class text-xs text-red-500
            // Expect at least one such error to be visible
            const validationErrors = page.locator('.text-red-500, .text-red-400');
            await expect(validationErrors.first()).toBeVisible({ timeout: 5_000 });
        });
    });

    // ── 3. Auth Guard – Redirect Unauthenticated Users ────────────────────────
    test('should redirect unauthenticated users from /add-employee to /auth', async ({ page }) => {
        // Navigate directly without logging in first
        await page.goto('/add-employee');

        // ProtectedRoute should redirect to /auth
        await page.waitForURL('**/auth', { timeout: 10_000 });
        await expect(page).toHaveURL(/auth/);
    });
});
