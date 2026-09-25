import { defineConfig, devices } from "@playwright/test"

const ROOT = "http://127.0.0.1:4173/"
/** GitHub Pages serves the site under /books/; one project checks the build there. */
const SUBPATH = "http://127.0.0.1:4174/books/"

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: [
    {
      command: `npm run build -- --site-url ${ROOT} && npm run serve -- --site-url ${ROOT} --port 4173`,
      url: `${ROOT}zh/`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: `npm run build -- --out dist-subpath --site-url ${SUBPATH} && npm run serve -- --out dist-subpath --site-url ${SUBPATH} --port 4174`,
      url: `${SUBPATH}zh/`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
  projects: [
    {
      name: "desktop",
      testIgnore: /subpath\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 860 }, baseURL: ROOT },
    },
    { name: "mobile", testIgnore: /subpath\.spec\.ts/, use: { ...devices["Pixel 7"], baseURL: ROOT } },
    {
      name: "subpath",
      testMatch: /subpath\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: SUBPATH },
    },
  ],
})
