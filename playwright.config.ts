import { defineConfig, devices } from "@playwright/test";

// The functional suite must run against the isolated QA Postgres (docker
// container `neurogauge-qa-pg`), never the hosted database in .env files.
// Next.js does not override env vars that are already set, so passing
// DATABASE_URL here wins over .env.development.local.
const QA_DATABASE_URL =
  process.env.QA_DATABASE_URL ??
  "postgresql://postgres:qa@localhost:5434/neurogauge_qa";

export default defineConfig({
  testDir: "./e2e",
  // The Next.js dev server flakes (chunk-load/hydration errors) under many
  // parallel first-compiles, so keep workers low.
  workers: 2,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Production build: the dev server's on-demand compilation causes
    // hydration flakiness under parallel test load.
    command: "npm run build && npm start",
    url: "http://localhost:3000",
    // Never reuse a server that may be connected to the wrong database.
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      DATABASE_URL: QA_DATABASE_URL,
      PRISMA_DATABASE_URL: QA_DATABASE_URL,
    },
  },
});
