import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

const PAGES = [
  "/zh/",
  "/en/",
  "/zh/linear-algebra/",
  "/en/calculus/",
  "/zh/linear-algebra/00/",
  "/zh/linear-algebra/02/",
  "/en/calculus/02/",
  "/en/probability/02/",
  "/404.html",
]

for (const path of PAGES) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`${path} in ${colorScheme} mode meets WCAG 2.1 AA`, async ({ page }) => {
      await page.emulateMedia({ colorScheme })
      await page.goto(path)
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual(
        [],
      )
    })
  }

  test(`${path} loads without errors or horizontal scrolling`, async ({ page }) => {
    const errors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text())
    })
    page.on("pageerror", (error) => errors.push(String(error)))
    await page.goto(path)
    await page.waitForLoadState("networkidle")
    expect(errors).toEqual([])
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
}

test("reading a page requests nothing from other origins", async ({ page }) => {
  const foreign: string[] = []
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1")) foreign.push(request.url())
  })
  for (const path of PAGES) await page.goto(path, { waitUntil: "networkidle" })
  expect(foreign).toEqual([])
})

test("giscus is the one third-party request, and only once the comments are scrolled to", async ({
  page,
}) => {
  const foreign: string[] = []
  await page.route("https://giscus.app/**", (route) => route.abort())
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1")) foreign.push(request.url())
  })
  await page.goto("/zh/linear-algebra/02/", { waitUntil: "networkidle" })
  expect(foreign).toEqual([])
  await page.locator(".comments").scrollIntoViewIfNeeded()
  await expect.poll(() => foreign).toEqual(["https://giscus.app/client.js"])
})

test("unknown paths get the bilingual 404 page", async ({ page }) => {
  const response = await page.goto("/zh/no-such-book/")
  expect(response?.status()).toBe(404)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("页面不存在")
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Page not found")
})
