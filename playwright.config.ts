import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3471);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      E2E_TEST_MODE: "1",
      APP_URL: `http://localhost:${PORT}`,
      HACKCLUB_AUTH_URL: `http://localhost:${PORT}/test-oauth/hackclub`,
      HACKATIME_URL: `http://localhost:${PORT}/test-oauth/hackatime`,
      YOUTUBE_OEMBED_URL: `http://localhost:${PORT}/test-oauth/youtube/oembed`,
      ADMIN_HACKCLUB_IDS: "ident!e2e-admin",
      // Override .env so e2e runs never touch the real Airtable base.
      AIRTABLE_API_URL: `http://localhost:${PORT}/test-oauth/airtable`,
      AIRTABLE_PAT: "pat-e2e",
      AIRTABLE_APP_NAME: "appE2E",
      AIRTABLE_TABLE_NAME: "tblE2E",
      HACKCLUB_AUTH_EXTRA_SCOPES: "",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://fellows:fellows@localhost:5443/fellows_test",
    },
  },
});
