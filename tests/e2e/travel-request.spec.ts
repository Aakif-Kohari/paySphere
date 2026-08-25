import { test, expect } from '@playwright/test';

test.describe('TravelRequestCard Workflow Integration Suite', () => {
  const MOCK_API_PATH = '**/api/travel-requests';

  test.beforeEach(async ({ page }) => {
    // Navigate to the target page housing the TravelRequestCard component
    await page.goto('/dashboard/travel');
    await expect(page.locator('.travel-request-card')).toBeVisible();
  });

  test('should successfully compile and submit a valid travel request workflow', async ({ page }) => {
    // Intercept and mock successful API network payload
    await page.route(MOCK_API_PATH, async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'tr-9921', status: 'PENDING_APPROVAL' }),
      });
    });

    const card = page.locator('.travel-request-card');

    // Populate data inputs
    await card.getByLabel('Destination').fill('Paris, France');
    await card.getByLabel('Departure Date').fill('2026-09-15');
    await card.getByLabel('Estimated Budget (INR)').fill('125000');
    await card.getByLabel('Reason for Travel').fill('On-site architectural audit and planning.');

    // Submit request action
    const submitBtn = card.getByRole('button', { name: /submit request/i });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Verify loading spinner visual state transition during execution
    await expect(card.locator('.loading-spinner')).toBeVisible();

    // Verify UI response to successful API resolution
    await expect(page.locator('.toast-success')).toBeVisible();
    await expect(page.locator('.toast-success')).toContainText('Travel request submitted successfully');
    await expect(card.locator('.status-badge')).toContainText('Pending Approval');
  });

  test('should enforce strict client-side validation thresholds and prevent processing', async ({ page }) => {
    const card = page.locator('.travel-request-card');
    const submitBtn = card.getByRole('button', { name: /submit request/i });

    // Try submitting an completely blank form payload
    await submitBtn.click();

    // Verify individual field validation notifications are present
    await expect(card.locator('.error-message[data-field="destination"]')).toHaveText('Destination is required');
    await expect(card.locator('.error-message[data-field="budget"]')).toHaveText('Budget must be greater than 0');

    // Test negative constraint values edge case
    await card.getByLabel('Estimated Budget (INR)').fill('-500');
    await expect(card.locator('.error-message[data-field="budget"]')).toHaveText('Budget cannot be negative');
    await expect(submitBtn).toBeDisabled();
  });

  test('should gracefully handle API failure scenarios and remain interactive', async ({ page }) => {
    // Intercept network and simulate a 500 internal infrastructure crash
    await page.route(MOCK_API_PATH, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal Server Error' }),
      });
    });

    const card = page.locator('.travel-request-card');

    // Fill valid data to cross client validation rules
    await card.getByLabel('Destination').fill('Tokyo, Japan');
    await card.getByLabel('Departure Date').fill('2026-10-20');
    await card.getByLabel('Estimated Budget (INR)').fill('180000');
    
    // Submit request triggering the mock backend failure
    await card.getByRole('button', { name: /submit request/i }).click();

    // Verify error notification visibility banner
    await expect(page.locator('.toast-error')).toBeVisible();
    await expect(page.locator('.toast-error')).toContainText('Failed to process request. Please try again.');

    // Verify form re-enables interactive controls so the user can amend data
    await expect(card.getByRole('button', { name: /submit request/i })).toBeEnabled();
    await expect(card.getByLabel('Destination')).toHaveValue('Tokyo, Japan');
  });
});
