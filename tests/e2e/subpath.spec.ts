import { expect, test } from "@playwright/test"

// baseURL ends in /books/; every path here is relative so it stays under it.

test("under a sub-path, the entry page forwards within it", async ({ page }) => {
  await page.goto("./")
  await expect(page).toHaveURL(/\/books\/(zh|en)\/$/)
})

test("under a sub-path, every link on a chapter page stays inside the site", async ({ page, baseURL }) => {
  await page.goto("zh/linear-algebra/01/")
  const hrefs = await page
    .locator("a[href^='/']")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")))
  expect(hrefs.length).toBeGreaterThanOrEqual(8)
  expect(hrefs.filter((href) => !href?.startsWith(new URL(baseURL ?? "").pathname))).toEqual([])
})

test("under a sub-path, a search result opens its chapter", async ({ page }) => {
  await page.goto("en/")
  await page.keyboard.press("/")
  await page.locator(".pagefind-ui__search-input").fill("expectation")
  const result = page.locator(".pagefind-ui__result-link").first()
  await expect(result).toContainText("Random Variables")
  const href = await result.getAttribute("href")
  expect(href).toMatch(/^\/books\/en\/probability\/02\//)
  const response = await page.goto(href ?? "")
  expect(response?.status()).toBe(200)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Random Variables")
})
