import { expect, test } from "@playwright/test"

test("the entry page follows a saved choice, then the browser language", async ({ browser }) => {
  for (const [locale, expected] of [
    ["en-US", "/en/"],
    ["zh-CN", "/zh/"],
    ["fr-FR", "/zh/"],
  ] as const) {
    const context = await browser.newContext({ locale })
    const page = await context.newPage()
    await page.goto("/")
    await expect(page).toHaveURL(new RegExp(`${expected}$`))
    await context.close()
  }
})

test("switching language keeps the chapter and is remembered", async ({ page }) => {
  await page.goto("/zh/calculus/02/")
  await page.locator('a[data-language="en"]').first().click()
  await expect(page).toHaveURL(/\/en\/calculus\/02\/$/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Derivatives")
  await page.goto("/")
  await expect(page).toHaveURL(/\/en\/$/)
})

test("the theme toggle wins over the system and persists", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" })
  await page.goto("/zh/")
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
  await page.locator("[data-theme-toggle]").click()
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
  await page.goto("/zh/linear-algebra/01/")
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
})

test("search finds chapters in the page's language", async ({ page }) => {
  for (const [path, query, expected] of [
    ["/zh/", "矩阵乘法", "矩阵"],
    ["/en/", "expectation", "Random Variables"],
  ] as const) {
    await page.goto(path)
    await page.keyboard.press("/")
    const input = page.locator(".pagefind-ui__search-input")
    await expect(input).toBeFocused()
    await input.fill(query)
    await expect(page.locator(".pagefind-ui__result-link").first()).toContainText(expected)
    const filter = path === "/zh/" ? "书" : "Book"
    await expect(page.locator(".pagefind-ui__filter-name").first()).toHaveText(filter)
    await page.keyboard.press("Escape")
    await expect(page.locator("[data-search-dialog]")).not.toBeVisible()
  }
})

test("search downloads nothing until it is opened", async ({ page }) => {
  const requests: string[] = []
  page.on("request", (request) => {
    if (request.url().includes("/pagefind/")) requests.push(request.url())
  })
  await page.goto("/zh/linear-algebra/01/", { waitUntil: "networkidle" })
  expect(requests).toEqual([])
  await page.locator("[data-search-open]").click()
  await expect(page.locator(".pagefind-ui__search-input")).toBeVisible()
  expect(requests.length).toBeGreaterThan(0)
})

test("a saved theme is applied before the script bundle runs", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" })
  await page.addInitScript(() => localStorage.setItem("theme", "dark"))
  await page.route("**/assets/site.*.js", (route) => route.abort())
  await page.goto("/zh/linear-algebra/01/")
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
})

test("if the script bundle fails, folded callouts stay readable", async ({ page }) => {
  await page.route("**/assets/site.*.js", (route) => route.abort())
  await page.goto("/zh/linear-algebra/02/")
  await expect(page.locator("html")).not.toHaveClass(/\bjs\b/)
  await expect(page.locator('.callout[data-callout="proof"] .callout-content')).toBeVisible()
  await expect(page.locator("[data-search-open]")).toBeHidden()
  await expect(page.locator("[data-theme-toggle]")).toBeHidden()
})

test("a foldable proof opens from the keyboard", async ({ page }) => {
  await page.goto("/zh/linear-algebra/02/")
  const callout = page.locator('.callout[data-callout="proof"]')
  const content = callout.locator(".callout-content")
  await expect(content).toBeHidden()
  const title = callout.locator(".callout-title")
  await title.focus()
  await expect(title).toHaveAttribute("aria-expanded", "false")
  await page.keyboard.press("Enter")
  await expect(content).toBeVisible()
  await expect(title).toHaveAttribute("aria-expanded", "true")
})

test("a deep link lands below the sticky header", async ({ page }) => {
  await page.goto(`/zh/linear-algebra/02/#${encodeURIComponent("结合律")}`)
  const heading = page.locator('[id="结合律"]')
  await expect(heading).toBeInViewport()
  const top = await heading.evaluate((element) => element.getBoundingClientRect().top)
  expect(top).toBeGreaterThanOrEqual(56)
})

test("code blocks can be copied", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "clipboard permissions are Chromium-only")
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto("/en/calculus/02/")
  const figure = page.locator("figure[data-rehype-pretty-code-figure]").first()
  await figure.hover()
  await figure.locator(".copy-button").click()
  await expect(figure.locator(".copy-button")).toHaveAttribute("aria-label", "Copied")
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toContain("const derivative")
})

test.describe("desktop", () => {
  test.skip(({ isMobile }) => isMobile, "the sidebar is a drawer on phones")

  test("the sidebar follows the section being read", async ({ page }) => {
    await page.goto("/zh/linear-algebra/02/")
    const link = page.locator('.toc-section a[data-section="结合律"]')
    await page.locator('[id="结合律"]').scrollIntoViewIfNeeded()
    await page.evaluate(() => {
      const heading = document.getElementById("结合律")
      if (heading) window.scrollTo(0, heading.offsetTop - 70)
    })
    await expect(link).toHaveClass(/is-active/)
    await expect(page.locator(".toc-link[aria-current=page]")).toContainText("矩阵")
  })
})

test.describe("phone without JavaScript", () => {
  test.skip(({ isMobile }) => !isMobile, "only phones use the drawer")
  test.use({ javaScriptEnabled: false })

  test("the contents are shown above the text", async ({ page }) => {
    await page.goto("/zh/probability/01/")
    await expect(page.locator("#sidebar .toc-link").first()).toBeVisible()
    await expect(page.locator("[data-sidebar-toggle]")).toBeHidden()
  })
})

test.describe("phone", () => {
  test.skip(({ isMobile }) => !isMobile, "only phones use the drawer")

  test("the contents drawer opens from the header and closes with Escape", async ({ page }) => {
    await page.goto("/zh/probability/01/")
    const sidebar = page.locator("#sidebar")
    const toggle = page.locator("[data-sidebar-toggle]")
    await expect(sidebar).not.toBeInViewport()
    await toggle.click()
    await expect(toggle).toHaveAttribute("aria-expanded", "true")
    await expect(sidebar).toBeInViewport()
    await expect(page.locator("#content")).toHaveJSProperty("inert", true)
    await page.keyboard.press("Escape")
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
    await expect(toggle).toBeFocused()
  })
})
