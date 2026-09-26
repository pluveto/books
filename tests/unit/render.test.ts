import assert from "node:assert/strict"
import test from "node:test"
import { PublishError } from "../../publish/errors.ts"
import { FileIndex } from "../../publish/obsidian/file-index.ts"
import { ChapterRenderer, type OutputKind } from "../../publish/render/renderer.ts"
import { MediaLibrary } from "../../publish/site/media.ts"
import { Routes } from "../../publish/routes.ts"
import { WebLinks } from "../../publish/site/web-links.ts"
import { makeVault, readSeries } from "../support/fixture.ts"

const LINKS = [
  "# 第二章",
  "",
  "## 本节",
  "",
  "章 [[01-第一章]]，节 [[01-第一章#小节]]，别名 [[01-第一章#小节|看这里]]，本页 [[#本节]]。",
  "",
  "书 [[alpha/book]]，丛书 [[series]]，外链 [[https://example.org|例子]]，英文 [[01-first]]。",
  "",
  "Markdown [相对](01-第一章.md#小节) 与 [外部](https://example.org)。",
  "",
  "![[figure.svg|示意图|320]]",
  "",
  "`[[不是链接]]` 与 $[[y]]$。",
  "",
  "> [!proof]- 证明 $x$",
  "> 正文",
  "",
].join("\n")

async function render(body: string, kind: OutputKind = "web", extra: Record<string, string> = {}) {
  const root = makeVault({ "alpha/zh/02-第二章.md": body, ...extra })
  const { vault, series } = readSeries(root)
  const routes = new Routes(new URL("https://books.example.org/sub/"))
  const chapter = series.books[0]?.edition("zh")?.chapter(2)
  assert.ok(chapter)
  const renderer = new ChapterRenderer(series, new FileIndex(vault.files), kind)
  return renderer.render(chapter, new WebLinks(routes, new MediaLibrary(vault, routes)))
}

async function rejects(body: string, message: RegExp, where: string, extra: Record<string, string> = {}) {
  await assert.rejects(render(body, "web", extra), (error: unknown) => {
    assert.ok(error instanceof PublishError, String(error))
    assert.match(error.message, message)
    assert.equal(error.describe().split(": ")[0], where)
    return true
  })
}

test("wikilinks, Markdown links and embeds resolve with Obsidian's rules", async () => {
  const html = decodeURI(await render(LINKS))
  assert.match(html, /<a href="\/sub\/zh\/alpha\/01\/">第一章<\/a>/)
  assert.match(html, /<a href="\/sub\/zh\/alpha\/01\/#小节">第一章 › 小节<\/a>/)
  assert.match(html, /<a href="\/sub\/zh\/alpha\/01\/#小节">看这里<\/a>/)
  assert.match(html, /<a href="\/sub\/zh\/alpha\/02\/#本节">本节<\/a>/)
  assert.match(html, /<a href="\/sub\/zh\/alpha\/">甲书<\/a>/)
  assert.match(html, /<a href="\/sub\/zh\/">测试丛书<\/a>/)
  assert.match(html, /<a href="https:\/\/example.org">例子<\/a>/)
  assert.match(html, /<a href="\/sub\/en\/alpha\/01\/">First<\/a>/)
  assert.match(html, /<a href="\/sub\/zh\/alpha\/01\/#小节">相对<\/a>/)
  assert.match(
    html,
    /<img src="\/sub\/media\/[0-9a-f]{12}\/figure.svg" alt="示意图" width="320" loading="lazy"/,
  )
  assert.match(html, /<code>\[\[不是链接\]\]<\/code>/)
  assert.match(html, /aria-label="\[\[y\]\]"/)
})

test("headings get the outline's ids and the title is left to the layout", async () => {
  const html = await render(LINKS)
  assert.doesNotMatch(html, /<h1/)
  assert.match(html, /<h2 id="本节">本节<a class="heading-anchor" href="#本节"/)
})

test("math is typeset to SVG at build time and labelled with its TeX", async () => {
  const html = await render("# 第二章\n\n行内 $x \\in \\R$。\n\n$$\n\\sum_{i=1}^n i\n$$\n")
  assert.match(html, /<span class="formula formula-inline" role="img" aria-label="x \\in \\R"><mjx-container/)
  assert.match(
    html,
    /<div class="formula formula-display" role="img" aria-label="\\sum_\{i=1\}\^n i"><mjx-container[^>]*display="true"/,
  )
  assert.doesNotMatch(html, /class="[^"]*math-(inline|display)|data-line=|<style/)
})

test("callouts, including foldable ones with math in the title, come from Quartz", async () => {
  const html = await render(LINKS)
  assert.match(html, /class="callout proof is-collapsible is-collapsed"/)
  assert.match(html, /data-callout="proof"/)
  assert.match(html, /callout-title-inner[\s\S]*证明[\s\S]*<mjx-container/)
})

test("highlights, comments, footnotes and tables follow Obsidian and GFM", async () => {
  const html = await render(
    "# 第二章\n\n==重点== 与 %%作者备注%% 之后[^1]。\n\n| a | b |\n| --- | --- |\n| $x$ | 2 |\n\n[^1]: 脚注。\n",
  )
  assert.match(html, /<span class="text-highlight">重点<\/span>/)
  assert.doesNotMatch(html, /作者备注/)
  assert.match(html, /<sup><a href="#user-content-fn-1" id="user-content-fnref-1"/)
  assert.match(
    html,
    /<section data-footnotes="" class="footnotes"><h2 class="sr-only" id="footnote-label">脚注<\/h2>/,
  )
  assert.match(html, /aria-label="返回正文第 1 处引用"/)
  assert.match(html, /<table>[\s\S]*<td><span class="formula formula-inline"/)
})

test("callouts without a title are named in the page's language", async () => {
  const html = await render(
    "# 第二章\n\n> [!note]\n> 甲\n\n> [!proof]-\n> 乙\n\n> [!summary]\n> 丙\n\n> [!custom]\n> 丁\n",
  )
  const titles = [...html.matchAll(/callout-title-inner"><p>([^<]*)<\/p>/g)].map((match) => match[1]?.trim())
  assert.deepEqual(titles, ["注", "证明", "摘要", "Custom"])
})

test("same-page Markdown fragments must name a heading", async () => {
  const html = decodeURI(await render("# 第二章\n\n## 本节\n\n见 [上面](#本节)。\n"))
  assert.match(html, /<a href="\/sub\/zh\/alpha\/02\/#本节">上面<\/a>/)
  await rejects(
    "# 第二章\n\n\n见 [哪里](#不存在)。\n",
    /no heading "不存在"/,
    "vault/alpha/zh/02-第二章.md:4",
  )
})

test("the PDF output leaves math as TeX for Pandoc", async () => {
  const html = await render("# 第二章\n\n$x$ 与\n\n$$\ny\n$$\n", "pdf")
  assert.match(html, /<span class="math inline" data-tex="x"><\/span>/)
  assert.match(html, /<span class="math display" data-tex="y"><\/span>/)
  assert.doesNotMatch(html, /mjx-container/)
})

test("broken formulas fail with the note and line", async () => {
  await rejects(
    "# 第二章\n\n好 $x$\n\n坏 $\\nosuch$\n",
    /formula \$\\nosuch\$ uses an undefined command/,
    "vault/alpha/zh/02-第二章.md:5",
  )
  await rejects("# 第二章\n\n$$\n\\frac{1}{\n$$\n", /formula/, "vault/alpha/zh/02-第二章.md:3")
})

test("broken links fail with the note and line", async () => {
  await rejects(
    "# 第二章\n\n[[不存在]]\n",
    /cannot resolve \[\[不存在\]\]: no note or file/,
    "vault/alpha/zh/02-第二章.md:3",
  )
  await rejects(
    "# 第二章\n\n\n[[01-第一章#没有这节]]\n",
    /no heading "没有这节"/,
    "vault/alpha/zh/02-第二章.md:4",
  )
  await rejects(
    "# 第二章\n\n![[01-第一章]]\n",
    /embedding notes is not supported/,
    "vault/alpha/zh/02-第二章.md:3",
  )
  await rejects("# 第二章\n\n[[01-第一章#^block]]\n", /block references/, "vault/alpha/zh/02-第二章.md:3")
  await rejects(
    "# 第二章\n\n![[shared.svg]]\n",
    /several files match; write the path instead: \[\[alpha\/assets\/shared.svg\]\] or \[\[alpha\/en\/shared.svg\]\]/,
    "vault/alpha/zh/02-第二章.md:3",
    { "alpha/assets/shared.svg": "<svg/>", "alpha/en/shared.svg": "<svg/>" },
  )
  const html = await render("# 第二章\n\n![[shared.svg]]\n", "web", {
    "alpha/zh/shared.svg": "<svg/>",
    "alpha/en/shared.svg": "<svg/>",
  })
  assert.match(html, /media\/[0-9a-f]{12}\/shared.svg/)
})
