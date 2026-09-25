import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { before, test } from "node:test"
import { SeriesReader } from "../../publish/obsidian/series-reader.ts"
import { Vault } from "../../publish/obsidian/vault.ts"
import { MarkdownParser } from "../../publish/render/parser.ts"
import { Site } from "../../publish/site/site.ts"
import { tempDir } from "../support/fixture.ts"
import { attribute, BuiltSite } from "../support/site-audit.ts"

const VAULT = path.resolve(import.meta.dirname, "../../vault")
const SITE_URL = new URL("https://books.example.org/books/")
let site: BuiltSite

async function build(out: string, search: boolean) {
  const vault = Vault.open(VAULT)
  await new Site(vault, new SeriesReader(vault, new MarkdownParser()).read(), {
    out,
    siteUrl: SITE_URL,
    search,
  }).build()
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

test("every page has a language, title, description and canonical URL", () => {
  for (const page of site.pages) {
    const [html] = BuiltSite.elements(page.tree, (node) => node.tagName === "html")
    assert.ok(html && attribute(html, "lang"), `${page.file} lacks lang`)
    const [title] = BuiltSite.elements(page.tree, (node) => node.tagName === "title")
    assert.ok(title && JSON.stringify(title.children).length > 20, `${page.file} lacks a title`)
    const meta = (name: string) =>
      BuiltSite.elements(page.tree, (node) => node.tagName === "meta" && attribute(node, "name") === name)[0]
    assert.ok(attribute(meta("description") ?? html, "content"), `${page.file} lacks a description`)
    const canonical = BuiltSite.elements(
      page.tree,
      (node) => node.tagName === "link" && attribute(node, "rel") === "canonical",
    )[0]
    if (page.file === "404.html") {
      assert.equal(canonical, undefined)
      assert.equal(attribute(meta("robots") ?? html, "content"), "noindex")
    } else {
      assert.equal(attribute(canonical ?? html, "href"), new URL(page.pathname, SITE_URL.origin).href)
    }
  }
})

test("hreflang alternates are reciprocal and the language switch keeps the chapter", () => {
  for (const page of site.pages.filter((page) => page.file.split("/").length === 4)) {
    const alternates = BuiltSite.elements(
      page.tree,
      (node) => node.tagName === "link" && attribute(node, "rel") === "alternate",
    ).map((node) => new URL(attribute(node, "href") ?? "").pathname)
    assert.ok(alternates.includes(page.pathname), `${page.file} does not list itself`)
    for (const other of alternates) {
      const back = site.page(other)
      assert.ok(back, `${page.file} points at missing ${other}`)
      const returned = BuiltSite.elements(
        back.tree,
        (node) => node.tagName === "link" && attribute(node, "rel") === "alternate",
      ).map((node) => new URL(attribute(node, "href") ?? "").pathname)
      assert.ok(returned.includes(page.pathname), `${other} does not point back at ${page.pathname}`)
    }
  }
  const zh = site.page("/books/zh/calculus/02/")
  assert.ok(zh)
  const [switchLink] = BuiltSite.elements(
    zh.tree,
    (node) => node.tagName === "a" && attribute(node, "dataLanguage") === "en",
  )
  assert.equal(attribute(switchLink ?? (zh.tree.children[0] as never), "href"), "/books/en/calculus/02/")
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
  assert.match(sitemap, /<loc>https:\/\/books\.example\.org\/books\/zh\/linear-algebra\/01\/<\/loc>/)
  assert.match(sitemap, /hreflang="en" href="https:\/\/books\.example\.org\/books\/en\/linear-algebra\/01\/"/)
  assert.doesNotMatch(sitemap, /404\.html/)
  const robots = fs.readFileSync(path.join(site.root, "robots.txt"), "utf8")
  assert.match(robots, /Sitemap: https:\/\/books\.example\.org\/books\/sitemap\.xml/)
  assert.ok(fs.existsSync(path.join(site.root, "pagefind", "pagefind-ui.js")))
  const languages = fs.readdirSync(path.join(site.root, "pagefind", "index")).length
  assert.ok(languages > 0)
})

test("two builds of the same vault are byte-identical", async () => {
  const hash = (root: string) => {
    const digest = crypto.createHash("sha256")
    for (const file of BuiltSite.walk(root))
      digest.update(file).update(fs.readFileSync(path.join(root, file)))
    return digest.digest("hex")
  }
  const [first, second] = [tempDir("books-a-"), tempDir("books-b-")]
  await build(first, false)
  await build(second, false)
  assert.equal(hash(first), hash(second))
})
