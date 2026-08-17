import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for PaySphere E2E Tests
 *
 * Issue: #1041
 *
 * Covers:
 *  - auth.spec.js           – login, logout, protected-route guard
 *  - employee-creation.spec.js – full employee creation flow
 *  - payroll-workflow.spec.js  – payroll report generation
 *  - payroll-approval.spec.js  – payroll approval workflow
 *
 * Environment variables are loaded from `.env.test` (local) or from the
 * process environment (CI).  Create a `.env.test` file based on
 * `.env.example` and set at minimum:
 *   TEST_USER_EMAIL=<your test account email>
 *   TEST_USER_PASSWORD=<your test account password>
 *   BASE_URL=http://localhost:5173   (optional – default shown)
 */

export default defineConfig({
    // Directory where test files live
    testDir: './e2e',

    // Per-test timeout (ms) – generous to allow for slow API round-trips
    timeout: 60_000,

    // Run tests in files in parallel
    fullyParallel: true,

    // Fail the build on CI if you accidentally left test.only in the source code
    forbidOnly: !!process.env.CI,

    // Retry on CI only
    retries: process.env.CI ? 2 : 0,

    // Opt out of parallel tests on CI
    workers: process.env.CI ? 1 : undefined,

    // Reporter to use
    reporter: process.env.CI ? 'github' : 'html',

    // Shared settings for all projects
    use: {
        // Base URL to use in actions like `await page.goto('/')`
        baseURL: process.env.BASE_URL || 'http://localhost:5173',

        // Collect trace when retrying failed tests – viewable via `npx playwright show-trace`
        trace: 'on-first-retry',

        // Screenshot on failure
        screenshot: 'only-on-failure',

        // Video on first retry so the CI report includes a recording
        video: 'retain-on-failure',

        // Reasonable action timeout for slower CI machines
        actionTimeout: 15_000,
    },

    // Browser projects to test against
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },

        // Uncomment to add cross-browser coverage:
        // {
        //   name: 'firefox',
        //   use: { ...devices['Desktop Firefox'] },
        // },
        // {
        //   name: 'webkit',
        //   use: { ...devices['Desktop Safari'] },
        // },
    ],

    // Spin up the Vite dev server before running tests locally.
    // On CI the server is assumed to already be running (or started separately).
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        // Reuse an already-running server in development; always start fresh on CI
        reuseExistingServer: !process.env.CI,
        // Allow up to 2 minutes for the Vite server to become ready
        timeout: 120_000,
        // Pipe Vite's output to stderr so it doesn't clutter test output
        stderr: 'pipe',
    },
});
