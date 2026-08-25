import { test, expect } from '@playwright/test';

test.describe('SoftwareLicenseCard Workflow Integration Suite', () => {
  const MOCK_API_PATH = '**/api/software-licenses';

  test.beforeEach(async ({ page }) => {
    // Open the asset dashboard tracking workspace
    await page.goto('/dashboard/licenses');
    await expect(page.locator('.software-license-card')).toBeVisible();
  });

  test('should successfully render active allocations and process a valid seat renewal workflow', async ({ page }) => {
    // Intercept update paths and return successful mock payload
    await page.route(MOCK_API_PATH, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'lic-8842', status: 'ACTIVE', remainingSeats: 15 }),
      });
    });

    const card = page.locator('.software-license-card');

    // Confirm core metadata elements mount correctly
    await expect(card.locator('.license-title')).toHaveText('IntelliJ IDEA Enterprise');
    await expect(card.locator('.seat-allocation-display')).toContainText('10 / 25 Seats Used');

    // Interact with seat modifications panel
    await card.getByRole('button', { name: /manage seats/i }).click();
    await card.getByLabel('Seats to Allocate').fill('5');
    
    // Fire renewal/allocation patch submission
    const saveBtn = card.getByRole('button', { name: /save allocations/i });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Verify system locking mechanics and success notifications respond to transaction resolution
    await expect(card.locator('.loading-overlay')).toBeVisible();
    await expect(page.locator('.toast-success')).toBeVisible();
    await expect(page.locator('.toast-success')).toContainText('License seats updated successfully');
    await expect(card.locator('.seat-allocation-display')).toContainText('15 / 25 Seats Used');
  });

  test('should block invalid configuration states and prevent oversized seats allocation bounds', async ({ page }) => {
    const card = page.locator('.software-license-card');
    
    await card.getByRole('button', { name: /manage seats/i }).click();
    const seatsInput = card.getByLabel('Seats to Allocate');
    const saveBtn = card.getByRole('button', { name: /save allocations/i });

    // Scenario: Trying to allocate more seats than total purchased pool limit
    await seatsInput.fill('50'); // Over absolute max threshold (25 available)
    await expect(card.locator('.error-message')).toHaveText('Allocation exceeds maximum available license seats');
    await expect(saveBtn).toBeDisabled();

    // Scenario: Validation boundary check for negative seat configurations
    await seatsInput.fill('-2');
    await expect(card.locator('.error-message')).toHaveText('Seat allocation count must be a positive integer');
    await expect(saveBtn).toBeDisabled();
  });

  test('should gracefully handle network failure scenarios during license modification', async ({ page }) => {
    // Intercept network routes to simulate a sudden 409 Conflict/Failure event
    await page.route(MOCK_API_PATH, async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'License key expired or revoked upstream.' }),
      });
    });

    const card = page.locator('.software-license-card');

    await card.getByRole('button', { name: /manage seats/i }).click();
    await card.getByLabel('Seats to Allocate').fill('2');
    await card.getByRole('button', { name: /save allocations/i }).click();

    // Verify systemic isolation handles down-stream failures without dropping view variables
    await expect(page.locator('.toast-error')).toBeVisible();
    await expect(page.locator('.toast-error')).toContainText('License key expired or revoked upstream.');
    
    // Ensure form inputs remain editable for manual remediation workflows
    await expect(card.getByRole('button', { name: /save allocations/i })).toBeEnabled();
    await expect(card.getByLabel('Seats to Allocate')).toHaveValue('2');
  });
});
