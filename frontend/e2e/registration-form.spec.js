import { test, expect } from '@playwright/test';

/**
 * RegistrationForm Workflow E2E Tests
 *
 * Issue: #1522
 *
 * Tests the user registration signup entry point:
 * 1. Rendering of signup fields and tab selectors
 * 2. Switching between Login and Signup tabs
 * 3. Password strength meter feedback based on password complexity
 * 4. Client-side blocking and error alert for weak passwords (score < 3)
 * 5. Server-side error handling for duplicate email registration
 * 6. Successful registration and redirect to dashboard
 */

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';

test.describe('RegistrationForm Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.waitForTimeout(500);

    // Switch to signup tab
    const signupTabBtn = page.locator('button:has-text("Create Account")');
    await signupTabBtn.click();
    await page.waitForTimeout(300);
  });

  test('should render the signup form elements correctly', async ({ page }) => {
    await test.step('Verify signup form input fields', async () => {
      await expect(page.locator('#signup-fullname')).toBeVisible();
      await expect(page.locator('#signup-email')).toBeVisible();
      await expect(page.locator('#signup-company')).toBeVisible();
      await expect(page.locator('#signup-password')).toBeVisible();
      await expect(page.locator('button[type="submit"]:has-text("Create Account")')).toBeVisible();
    });
  });

  test('should update password strength feedback as user types', async ({ page }) => {
    const passwordInput = page.locator('#signup-password');

    await test.step('Verify weak password indicator', async () => {
      await passwordInput.fill('123');
      await expect(page.locator('span:has-text("Very Weak"), span:has-text("Weak")').first()).toBeVisible();
    });

    await test.step('Verify strong password indicator', async () => {
      await passwordInput.fill('StrongPassword123!_LongText');
      await expect(page.locator('span:has-text("Strong"), span:has-text("Good")').first()).toBeVisible();
    });
  });

  test('should block registration on weak password submit', async ({ page }) => {
    await test.step('Fill in signup form with weak password', async () => {
      await page.locator('#signup-fullname').fill('Jane Doe');
      await page.locator('#signup-email').fill('janedoe@company.com');
      await page.locator('#signup-company').fill('Acme Inc');
      await page.locator('#signup-password').fill('123456');
    });

    await test.step('Submit form and verify client blocking', async () => {
      await page.click('button[type="submit"]:has-text("Create Account")');
      await page.waitForTimeout(500);

      // Verify validation error
      const errorMsg = page.locator('p:has-text("Password is too weak")');
      await expect(errorMsg).toBeVisible();
    });
  });

  test('should display server error on duplicate email registration attempt', async ({ page }) => {
    await test.step('Fill in signup form with already registered email', async () => {
      await page.locator('#signup-fullname').fill('Test User');
      await page.locator('#signup-email').fill(TEST_EMAIL);
      await page.locator('#signup-company').fill('Acme Inc');
      await page.locator('#signup-password').fill('StrongPassword123!_LongText');
    });

    await test.step('Submit duplicate email registration', async () => {
      await page.click('button[type="submit"]:has-text("Create Account")');
      await page.waitForTimeout(1000);
    });

    await test.step('Verify error message rendering', async () => {
      const errorMsg = page.locator('p:has-text("registered"), p:has-text("exists"), p:has-text("conflict")');
      // If server responds with error, it will show as standard text alert
      await expect(errorMsg.first()).toBeVisible();
    });
  });

  test('should register and redirect to dashboard with unique email', async ({ page }) => {
    const randomEmail = `newcompany_${Date.now()}@paysphere.com`;

    await test.step('Fill in registration form with unique email', async () => {
      await page.locator('#signup-fullname').fill('New Merchant Admin');
      await page.locator('#signup-email').fill(randomEmail);
      await page.locator('#signup-company').fill('New Global Corp');
      await page.locator('#signup-password').fill('StrongPassword123!_LongText');
    });

    await test.step('Submit registration form', async () => {
      await page.click('button[type="submit"]:has-text("Create Account")');
    });

    await test.step('Assert redirect to dashboard', async () => {
      await page.waitForURL('**/dashboard**', { timeout: 15_000 });
      expect(page.url()).toContain('/dashboard');
    });
  });
});
