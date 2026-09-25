import { defineConfig, devices } from "@playwright/test"

const PORT = 4173
const SITE = `http://127.0.0.1:${PORT}/`

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: SITE, trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: {
    command: `npm run build -- --site-url ${SITE} && npm run serve -- --site-url ${SITE} --port ${PORT}`,
    url: `${SITE}zh/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 860 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
})
