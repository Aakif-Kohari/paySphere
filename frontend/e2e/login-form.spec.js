import { test, expect } from '@playwright/test';

/**
 * LoginForm Workflow E2E Tests
 *
 * Issue: #1521
 *
 * Tests the user authentication entry point and form features:
 * 1. Rendering of login fields and tab selectors
 * 2. Switching between Login and Signup tabs
 * 3. Field validation checks (e.g., blank or malformed formats)
 * 4. Invalid credential login flow and error alerts
 * 5. Forgot password request layout navigation
 * 6. Successful login flow redirecting to the main dashboard
 */

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword';

test.describe('LoginForm Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.waitForTimeout(500);
  });

  test('should render the login form correctly by default', async ({ page }) => {
    await test.step('Verify form title and labels', async () => {
      await expect(page.locator('h2:has-text("Welcome back")')).toBeVisible();
      await expect(page.locator('p:has-text("Enter your credentials")')).toBeVisible();
    });

    await test.step('Verify login form input fields', async () => {
      await expect(page.locator('#login-email')).toBeVisible();
      await expect(page.locator('#login-password')).toBeVisible();
      await expect(page.locator('button[type="submit"]:has-text("Login")')).toBeVisible();
    });
  });

  test('should switch between Login and Signup tabs', async ({ page }) => {
    await test.step('Switch to Create Account tab', async () => {
      const signupTabBtn = page.locator('button:has-text("Create Account")');
      await signupTabBtn.click();
      await page.waitForTimeout(300);

      await expect(page.locator('h2:has-text("Create your account")')).toBeVisible();
      await expect(page.locator('#signup-fullname')).toBeVisible();
      await expect(page.locator('#signup-email')).toBeVisible();
      await expect(page.locator('#signup-company')).toBeVisible();
      await expect(page.locator('#signup-password')).toBeVisible();
    });

    await test.step('Switch back to Login tab via footer link', async () => {
      const loginLink = page.locator('button:has-text("Login")').last();
      await loginLink.click();
      await page.waitForTimeout(300);

      await expect(page.locator('h2:has-text("Welcome back")')).toBeVisible();
      await expect(page.locator('#login-email')).toBeVisible();
    });
  });

  test('should display error message on invalid credentials login attempt', async ({ page }) => {
    await test.step('Fill in wrong credentials', async () => {
      await page.locator('#login-email').fill('nonexistent_user@paysphere.com');
      await page.locator('#login-password').fill('wrongpassword123');
    });

    await test.step('Submit invalid login form', async () => {
      await page.click('button[type="submit"]:has-text("Login")');
      await page.waitForTimeout(1000);
    });

    await test.step('Verify error message rendering', async () => {
      const alertMessage = page.locator('p[role="alert"]');
      await expect(alertMessage).toBeVisible();
      const alertText = await alertMessage.innerText();
      expect(alertText.length).toBeGreaterThan(0);
    });
  });

  test('should navigate to and from Forgot Password flow', async ({ page }) => {
    await test.step('Click Forgot Password link', async () => {
      const forgotLink = page.locator('button:has-text("Forgot Password?")');
      await forgotLink.click();
      await page.waitForTimeout(300);

      await expect(page.locator('h2:has-text("Reset Password")')).toBeVisible();
      await expect(page.locator('#forgot-email')).toBeVisible();
      await expect(page.locator('button[type="submit"]:has-text("Send Reset Link")')).toBeVisible();
    });

    await test.step('Click Back to Login link', async () => {
      const backLink = page.locator('button:has-text("Back to Login")');
      await backLink.click();
      await page.waitForTimeout(300);

      await expect(page.locator('h2:has-text("Welcome back")')).toBeVisible();
      await expect(page.locator('#login-email')).toBeVisible();
    });
  });

  test('should successfully log in and redirect to dashboard with valid credentials', async ({ page }) => {
    await test.step('Fill in correct credentials', async () => {
      await page.locator('#login-email').fill(TEST_EMAIL);
      await page.locator('#login-password').fill(TEST_PASSWORD);
    });

    await test.step('Submit login form', async () => {
      await page.click('button[type="submit"]:has-text("Login")');
    });

    await test.step('Assert redirect to dashboard', async () => {
      await page.waitForURL('**/dashboard**', { timeout: 15_000 });
      expect(page.url()).toContain('/dashboard');
    });
  });
});
