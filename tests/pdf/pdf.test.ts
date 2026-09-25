import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import path from "node:path"
import test from "node:test"
import type { LanguageCode } from "../../publish/model/language.ts"
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

function editions() {
  const vault = Vault.open(VAULT)
  const series = new SeriesReader(vault, new MarkdownParser()).read()
  const routes = new Routes(series.settings.siteUrl)
  return series.books.flatMap((book) =>
    book.editions.map((edition) => ({
      name: `${book.slug}.${edition.language}`,
      language: edition.language,
      pdf: new PdfBook(vault, series, edition, routes),
    })),
  )
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
    const [linearAlgebra] = editions()
    assert.ok(linearAlgebra)
    const nodes = collect(await linearAlgebra.pdf.inspect())
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
const LABELS: Record<LanguageCode, RegExp> = { zh: /第\s*一\s*章/, en: /Chapter\s*1/ }

test(
  "every edition typesets to a PDF with chapter labels and no TeX source",
  { skip: !REQUIRED && !fullChain && "needs pandoc, xelatex, rsvg-convert and pdftotext" },
  async () => {
    const problems: string[] = []
    for (const { name, language, pdf } of editions()) {
      const output = path.join(tempDir("books-pdf-test-"), `${name}.pdf`)
      try {
        await pdf.write(output)
      } catch (error) {
        problems.push(`${name}: ${String(error)}`)
        continue
      }
      const text = spawnSync("pdftotext", ["-enc", "UTF-8", output, "-"], { encoding: "utf8" }).stdout
      if (text.length < 1000) problems.push(`${name}: the PDF has almost no text`)
      for (const leak of ["\\(", "\\[", "\\R", "\\norm", "\\mathbb", "\\P(", "↩"]) {
        if (text.includes(leak)) problems.push(`${name}: found ${leak}`)
      }
      if (!LABELS[language].test(text)) {
        problems.push(`${name}: no "${String(LABELS[language])}" chapter label`)
      }
      if (/^0\.\d/m.test(text)) problems.push(`${name}: the preface has numbered sections`)
    }
    assert.deepEqual(problems, [])
  },
)
