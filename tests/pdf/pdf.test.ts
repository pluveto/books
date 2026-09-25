import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import path from "node:path"
import test from "node:test"
import { SeriesReader } from "../../publish/obsidian/series-reader.ts"
import { Vault } from "../../publish/obsidian/vault.ts"
import { PdfBook } from "../../publish/pdf/pdf-book.ts"
import { MarkdownParser } from "../../publish/render/parser.ts"
import { Routes } from "../../publish/site/routes.ts"
import { tempDir } from "../support/fixture.ts"

const VAULT = path.resolve(import.meta.dirname, "../../vault")
/** CI sets this so a missing tool fails the job instead of skipping the check. */
const REQUIRED = process.env.BOOKS_REQUIRE_PDF_TOOLS === "1"

function has(tool: string): boolean {
  const result = spawnSync(tool, ["--version"], { encoding: "utf8", windowsHide: true })
  return result.error === undefined && result.status === 0
}

function book(slug: string, language: "zh" | "en") {
  const vault = Vault.open(VAULT)
  const series = new SeriesReader(vault, new MarkdownParser()).read()
  const edition = series.books.find((item) => item.slug === slug)?.edition(language)
  assert.ok(edition)
  return new PdfBook(vault, series, edition, new Routes(series.settings.siteUrl))
}

interface PandocNode {
  t: string
  c?: unknown
}

function collect(node: unknown, found: PandocNode[] = []): PandocNode[] {
  if (Array.isArray(node)) for (const item of node) collect(item, found)
  else if (node && typeof node === "object") {
    if (typeof (node as PandocNode).t === "string") found.push(node as PandocNode)
    for (const value of Object.values(node)) collect(value, found)
  }
  return found
}

test(
  "Pandoc reads formulas as math and footnotes as notes",
  { skip: !REQUIRED && !has("pandoc") && "needs pandoc" },
  async () => {
    const nodes = collect(await book("linear-algebra", "zh").inspect())
    const math = nodes.filter((node) => node.t === "Math")
    assert.ok(math.length > 10, `expected formulas, got ${math.length}`)
    assert.ok(
      math.some((node) => JSON.stringify(node.c).includes("\\norm{v}")),
      "book macros reach LaTeX unexpanded",
    )
    assert.ok(
      nodes.some((node) => node.t === "Note"),
      "footnotes become Pandoc notes",
    )
    const leftovers = nodes.filter((node) => {
      if (node.t !== "Span" && node.t !== "Div") return false
      const classes = (node.c as [[string, string[]]])[0][1]
      return classes.some((name) => ["math", "footnotes", "callout-title", "callout-content"].includes(name))
    })
    assert.deepEqual(leftovers, [])
  },
)

const fullChain = ["pandoc", "xelatex", "rsvg-convert", "pdftotext"].every(has)

test(
  "a typeset PDF contains no TeX source",
  {
    skip: !REQUIRED && !fullChain && "needs pandoc, xelatex, rsvg-convert and pdftotext",
  },
  async () => {
    for (const [slug, language] of [
      ["linear-algebra", "zh"],
      ["probability", "en"],
    ] as const) {
      const output = path.join(tempDir("books-pdf-test-"), "book.pdf")
      await book(slug, language).write(output)
      const text = spawnSync("pdftotext", ["-enc", "UTF-8", output, "-"], { encoding: "utf8" }).stdout
      assert.ok(text.length > 1000, `${slug}.${language}: the PDF has text`)
      for (const leak of ["\\(", "\\[", "\\R", "\\norm", "\\mathbb", "\\P(", "↩"]) {
        assert.equal(text.includes(leak), false, `${slug}.${language}: found ${leak}`)
      }
      if (language === "zh") assert.match(text, /第\s*(1|一)\s*章/)
    }
  },
)
