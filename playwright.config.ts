import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Causal desktop app E2E testing
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: false, // Desktop app tests should run serially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Run tests one at a time for desktop app
  reporter: [
    ["html", { outputFolder: "e2e-results/html" }],
    ["json", { outputFile: "e2e-results/results.json" }],
    ["list"],
  ],
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "desktop-macos",
      use: {
        ...devices["Desktop macOS"],
        // Tauri app specific configuration
        launchOptions: {
          // Will be configured in test setup
        },
      },
    },
  ],

  outputDir: "e2e-results/artifacts",
  timeout: 30000, // 30 seconds per test
  expect: {
    timeout: 5000, // 5 seconds for assertions
  },
});
