import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { before, test } from "node:test"
import zlib from "node:zlib"
import type { Element } from "hast"
import { SeriesReader } from "../../publish/obsidian/series-reader.ts"
import { Vault } from "../../publish/obsidian/vault.ts"
import { MarkdownParser } from "../../publish/render/parser.ts"
import { Site } from "../../publish/site/site.ts"
import { tempDir } from "../support/fixture.ts"
import { attribute, BuiltSite, type HtmlPage } from "../support/site-audit.ts"

const VAULT = path.resolve(import.meta.dirname, "../../vault")
const SITE_URL = new URL("https://books.example.org/books/")
let site: BuiltSite

async function build(out: string, search: boolean) {
  const vault = Vault.open(VAULT)
  await new Site(vault, new SeriesReader(vault, new MarkdownParser()).read(), {
    out,
    siteUrl: SITE_URL,
    search: search ? undefined : false,
  }).build()
}

function head(page: HtmlPage) {
  const all = (test: (node: Element) => boolean) => BuiltSite.elements(page.tree, test)
  const meta = (key: string) =>
    all(
      (node) => node.tagName === "meta" && (attribute(node, "name") ?? attribute(node, "property")) === key,
    ).map((node) => attribute(node, "content") ?? "")
  const links = (rel: string) =>
    all((node) => node.tagName === "link" && attribute(node, "rel") === rel).map((node) => ({
      href: attribute(node, "href") ?? "",
      hreflang: attribute(node, "hrefLang"),
    }))
  return { all, meta, links }
}

before(async () => {
  const out = tempDir("books-site-")
  await build(out, true)
  site = new BuiltSite(out, SITE_URL.pathname)
})

test("every page of every edition is built", () => {
  const expected = ["/books/", "/books/404.html", "/books/zh/", "/books/en/"]
  for (const language of ["zh", "en"]) {
    for (const book of ["linear-algebra", "calculus", "probability"]) {
      expected.push(`/books/${language}/${book}/`)
      for (const number of ["00", "01", "02"]) expected.push(`/books/${language}/${book}/${number}/`)
    }
  }
  assert.deepEqual(site.pages.map((page) => page.pathname).sort(), expected.sort())
})

test("every internal link, asset and fragment resolves", () => {
  const problems: string[] = []
  for (const page of site.pages) {
    const references = BuiltSite.elements(page.tree, (node) =>
      ["a", "link", "script", "img"].includes(node.tagName),
    ).flatMap((node) => {
      const url = attribute(node, "href") ?? attribute(node, "src")
      return url ? [{ node, url }] : []
    })
    for (const reference of references) {
      const { node } = reference
      const url = reference.url.startsWith(SITE_URL.href)
        ? reference.url.slice(SITE_URL.origin.length)
        : reference.url
      if (/^https?:/.test(url)) {
        if (node.tagName !== "a") problems.push(`${page.file}: external ${node.tagName} ${url}`)
        continue
      }
      const [pathname = "", rawFragment] = url.split("#")
      const target = pathname === "" ? page.pathname : pathname
      if (!site.exists(target)) {
        problems.push(`${page.file}: missing ${url}`)
        continue
      }
      if (rawFragment) {
        const fragment = decodeURIComponent(rawFragment)
        const targetPage = site.page(target)
        if (!targetPage?.ids.has(fragment)) problems.push(`${page.file}: missing #${fragment} in ${target}`)
      }
    }
  }
  assert.deepEqual(problems, [])
})

test("indexable pages carry title, description, canonical and Open Graph tags; the rest are noindex", () => {
  for (const page of site.pages) {
    const { all, meta, links } = head(page)
    const [html] = all((node) => node.tagName === "html")
    assert.ok(html && attribute(html, "lang"), `${page.file} lacks lang`)
    assert.ok(all((node) => node.tagName === "title").length === 1, `${page.file} lacks a title`)
    assert.ok(meta("description")[0], `${page.file} lacks a description`)
    const canonical = links("canonical")
    if (page.pathname === "/books/" || page.file === "404.html") {
      assert.deepEqual(canonical, [], `${page.file} must not be canonical`)
      assert.deepEqual(meta("robots"), ["noindex"], `${page.file} must be noindex`)
      continue
    }
    const url = new URL(page.pathname, SITE_URL.origin).href
    assert.equal(canonical[0]?.href, url, page.file)
    assert.equal(meta("og:url")[0], url, page.file)
    for (const key of ["og:title", "og:description", "og:locale", "og:site_name", "og:type"]) {
      assert.ok(meta(key)[0], `${page.file} lacks ${key}`)
    }
  }
})

test("hreflang alternates of every indexable page are reciprocal", () => {
  const alternates = (page: HtmlPage) =>
    head(page)
      .links("alternate")
      .filter((link) => link.hreflang !== "x-default")
      .map((link) => new URL(link.href).pathname)
  for (const page of site.pages.filter((page) => head(page).links("canonical").length)) {
    const own = alternates(page)
    assert.ok(own.includes(page.pathname), `${page.file} does not list itself`)
    for (const other of own) {
      const back = site.page(other)
      assert.ok(back, `${page.file} points at missing ${other}`)
      assert.ok(alternates(back).includes(page.pathname), `${other} does not point back at ${page.pathname}`)
    }
    const xDefault = head(page)
      .links("alternate")
      .filter((link) => link.hreflang === "x-default")
    assert.equal(xDefault.length, 1, `${page.file} has one x-default`)
    assert.match(
      new URL(xDefault[0]?.href ?? "").pathname,
      /^\/books\/zh\//,
      `${page.file} defaults to Chinese`,
    )
  }
})

test("the language switch keeps the chapter", () => {
  const zh = site.page("/books/zh/calculus/02/")
  assert.ok(zh)
  const [link] = BuiltSite.elements(
    zh.tree,
    (node) => node.tagName === "a" && attribute(node, "dataLanguage") === "en",
  )
  assert.ok(link)
  assert.equal(attribute(link, "href"), "/books/en/calculus/02/")
})

test("formulas and code are finished at build time", () => {
  for (const page of site.pages) {
    const html = fs.readFileSync(path.join(site.root, page.file), "utf8")
    assert.doesNotMatch(html, /class="[^"]*math-(inline|display)/, page.file)
    assert.doesNotMatch(html, /katex|mathjax\.js|tex-chtml|renderMathInElement|highlight\.js/i, page.file)
  }
  const chapter = fs.readFileSync(path.join(site.root, "zh/linear-algebra/01/index.html"), "utf8")
  assert.match(chapter, /<mjx-container class="MathJax" jax="SVG"/)
  assert.match(chapter, /aria-label="\\norm\{v\} = \\sqrt/)
  assert.match(chapter, /data-rehype-pretty-code-figure/)
  assert.match(chapter, /--shiki-dark:/)
})

test("sitemap, robots and search index are published", () => {
  const sitemap = fs.readFileSync(path.join(site.root, "sitemap.xml"), "utf8")
  const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? "").sort()
  const indexable = site.pages
    .filter((page) => head(page).links("canonical").length)
    .map((page) => new URL(page.pathname, SITE_URL.origin).href)
    .sort()
  assert.deepEqual(listed, indexable)
  assert.match(sitemap, /hreflang="en" href="https:\/\/books\.example\.org\/books\/en\/linear-algebra\/01\/"/)
  const robots = fs.readFileSync(path.join(site.root, "robots.txt"), "utf8")
  assert.match(robots, /Sitemap: https:\/\/books\.example\.org\/books\/sitemap\.xml/)
  assert.ok(fs.existsSync(path.join(site.root, "pagefind", "pagefind-ui.js")))
  const fragments = fs.readdirSync(path.join(site.root, "pagefind", "fragment"))
  const urls = fragments.map((name) =>
    zlib.gunzipSync(fs.readFileSync(path.join(site.root, "pagefind", "fragment", name))).toString("utf8"),
  )
  assert.ok(urls.length >= 18)
  assert.ok(
    urls.every((fragment) => /"url":"\/books\/(zh|en)\//.test(fragment)),
    "search results link under the base path",
  )
})

test("two builds are byte-identical outside Pagefind, whose index is equivalent but not reproducible", async () => {
  const hash = (root: string) => {
    const digest = crypto.createHash("sha256")
    for (const file of BuiltSite.walk(root).filter((file) => !file.startsWith("pagefind/"))) {
      digest.update(file).update(fs.readFileSync(path.join(root, file)))
    }
    return digest.digest("hex")
  }
  const languages = (root: string) => {
    const entry = JSON.parse(fs.readFileSync(path.join(root, "pagefind", "pagefind-entry.json"), "utf8")) as {
      languages: Record<string, { page_count: number }>
    }
    return Object.fromEntries(
      Object.entries(entry.languages).map(([code, { page_count }]) => [code, page_count]),
    )
  }
  const second = tempDir("books-again-")
  await build(second, true)
  assert.equal(hash(second), hash(site.root))
  assert.deepEqual(languages(second), languages(site.root))
  assert.deepEqual(languages(site.root), { en: 12, "zh-cn": 12 })
})
