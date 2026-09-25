import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { SeriesReader } from "../../publish/obsidian/series-reader.ts"
import { Vault } from "../../publish/obsidian/vault.ts"
import { MarkdownParser } from "../../publish/render/parser.ts"

export const SERIES_MD = `---
site_url: https://books.example.org
repository: https://github.com/example/books
languages: [zh, en]
books: [alpha]
license: CC BY 4.0
license_url: https://creativecommons.org/licenses/by/4.0/
code_license: MIT
code_license_url: https://opensource.org/licenses/MIT
zh:
  title: 测试丛书
  tagline: 用于测试。
en:
  title: Test Books
  tagline: For tests.
---
`

export const BOOK_MD = `---
color: "#1f4e5f"
cover: cover.svg
status: draft
macros: |
  \\newcommand{\\R}{\\mathbb{R}}
zh:
  title: 甲书
  subtitle: 副标题
  description: 简介。
en:
  title: Alpha
  subtitle: Subtitle
  description: Blurb.
---
`

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>`

/** A small valid vault; override or add files per test. `null` deletes a file. */
export function makeVault(files: Record<string, string | null> = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "books-vault-"))
  const all: Record<string, string | null> = {
    "series.md": SERIES_MD,
    "alpha/book.md": BOOK_MD,
    "alpha/cover.svg": SVG,
    "alpha/assets/figure.svg": SVG,
    "alpha/zh/00-前言.md": "# 前言\n\n见 [[01-第一章]]。\n",
    "alpha/zh/01-第一章.md": "# 第一章\n\n## 小节\n\n正文 $x \\in \\R$。\n",
    "alpha/en/00-preface.md": "# Preface\n\nSee [[01-first]].\n",
    "alpha/en/01-first.md": "# First\n\n## Section\n\nBody.\n",
    ...files,
  }
  for (const [file, content] of Object.entries(all)) {
    if (content === null) continue
    const target = path.join(root, ...file.split("/"))
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content)
  }
  return root
}

export function readSeries(root: string) {
  const vault = Vault.open(root)
  return { vault, series: new SeriesReader(vault, new MarkdownParser()).read() }
}

export function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}
