import { defineConfig } from "@playwright/test";

const baseURL = process.env.CFO_E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "apps/web/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: `${baseURL}/sign-in`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
