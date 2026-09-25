import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { MissingToolError, PublishError } from "../errors.ts"
import { messages } from "../i18n.ts"
import type { Chapter } from "../model/chapter.ts"
import type { Edition } from "../model/edition.ts"
import type { LanguageCode } from "../model/language.ts"
import type { Heading } from "../model/outline.ts"
import type { Series } from "../model/series.ts"
import { FileIndex } from "../obsidian/file-index.ts"
import type { Vault } from "../obsidian/vault.ts"
import { ChapterRenderer } from "../render/renderer.ts"
import type { LinkTarget } from "../render/scope.ts"
import type { Routes } from "../site/routes.ts"
import { typesetting } from "./typesetting.ts"

const FILTER = path.join(path.dirname(fileURLToPath(import.meta.url)), "obsidian.lua")

/** Inside the PDF, links to the same edition are anchors; everything else goes to the website. */
class PdfLinks implements LinkTarget {
  constructor(
    private readonly edition: Edition,
    private readonly routes: Routes,
    private readonly vault: Vault,
  ) {}

  chapter(chapter: Chapter, heading?: Heading): string {
    if (chapter.edition !== this.edition) return this.routes.absolute(this.routes.chapter(chapter, heading))
    return `#${heading ? this.headingId(chapter, heading) : PdfLinks.chapterId(chapter)}`
  }

  cover(edition: Edition): string {
    return this.routes.absolute(this.routes.cover(edition))
  }

  catalog(language: LanguageCode): string {
    return this.routes.absolute(this.routes.catalog(language))
  }

  media(file: string): string {
    return this.vault.absolute(file).split(path.sep).join("/")
  }

  headingId(chapter: Chapter, heading: Heading): string {
    return `${PdfLinks.chapterId(chapter)}-${heading.slug}`
  }

  static chapterId(chapter: Chapter): string {
    return `c${chapter.number}`
  }
}

/** One edition as a PDF: the same chapter trees as the website, typeset by Pandoc and XeLaTeX. */
export class PdfBook {
  constructor(
    private readonly vault: Vault,
    private readonly series: Series,
    private readonly edition: Edition,
    private readonly routes: Routes,
  ) {}

  async write(output: string): Promise<void> {
    PdfBook.require(["pandoc", "xelatex", "rsvg-convert"])
    this.requireFont()
    await this.withInput((input, header) => {
      fs.mkdirSync(path.dirname(output), { recursive: true })
      this.pandoc([...this.readerArguments(), ...this.writerArguments(header), input, "-o", output])
    })
  }

  /** Pandoc's JSON AST of the edition, read exactly as `write` reads it. */
  async inspect(): Promise<unknown> {
    PdfBook.require(["pandoc"])
    let json = ""
    await this.withInput((input) => {
      json = this.pandoc([...this.readerArguments(), "--to=json", input])
    })
    return JSON.parse(json) as unknown
  }

  async html(): Promise<string> {
    const renderer = new ChapterRenderer(this.series, new FileIndex(this.vault.files), "pdf")
    const links = new PdfLinks(this.edition, this.routes, this.vault)
    const sections: string[] = []
    for (const chapter of this.edition.chapters) {
      const body = await renderer.render(chapter, links)
      const numbered = chapter.isFrontMatter ? ` class="unnumbered"` : ""
      sections.push(
        `<h1 id="${PdfLinks.chapterId(chapter)}"${numbered}>${escape(chapter.title)}</h1>\n${body}`,
      )
    }
    const lang = messages(this.edition.language).htmlLang
    return `<!DOCTYPE html>\n<html lang="${lang}"><head><meta charset="utf-8"><title>${escape(this.edition.title)}</title></head><body>\n${sections.join("\n")}\n</body></html>\n`
  }

  private async withInput(use: (input: string, header: string) => void) {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "books-pdf-"))
    try {
      const input = path.join(work, "book.html")
      const header = path.join(work, "header.tex")
      fs.writeFileSync(input, await this.html(), "utf8")
      fs.writeFileSync(header, `\\usepackage{amsmath,amssymb}\n${this.edition.book.macros.tex}\n`, "utf8")
      use(input, header)
    } finally {
      fs.rmSync(work, { recursive: true, force: true })
    }
  }

  private readerArguments(): string[] {
    return ["--from=html+smart", `--lua-filter=${FILTER}`]
  }

  private writerArguments(header: string): string[] {
    const text = this.series.text(this.edition.language)
    const { htmlLang } = messages(this.edition.language)
    const setting = typesetting(this.edition.language)
    const args = [
      "--pdf-engine=xelatex",
      "--top-level-division=chapter",
      "--number-sections",
      "--toc",
      `--include-in-header=${header}`,
      `--metadata=title:${this.edition.title}`,
      `--metadata=subtitle:${this.edition.text.subtitle}`,
      `--metadata=author:${text.author ?? text.title}`,
      `--metadata=lang:${htmlLang}`,
      `--variable=documentclass:${setting.documentClass}`,
      `--variable=classoption:${setting.classOptions.join(",")}`,
      "--variable=geometry:margin=2.5cm",
      "--variable=colorlinks:true",
      "--variable=linkcolor:black",
      "--variable=urlcolor:black",
    ]
    const font = this.cjkFont()
    if (font) args.push(`--variable=CJKmainfont:${font}`)
    return args
  }

  private cjkFont(): string | undefined {
    const { cjkFont } = typesetting(this.edition.language)
    return cjkFont ? (process.env.BOOKS_CJK_FONT ?? cjkFont) : undefined
  }

  /** Where fontconfig exists, a missing CJK font is reported up front instead of by XeLaTeX. */
  private requireFont() {
    const font = this.cjkFont()
    if (!font) return
    const list = spawnSync("fc-list", [`:family=${font}`, "family"], { encoding: "utf8", windowsHide: true })
    if (list.error || list.status !== 0) return
    if (!list.stdout.trim()) throw new MissingToolError([`font "${font}" (or set BOOKS_CJK_FONT)`])
  }

  private pandoc(args: string[]): string {
    const result = spawnSync("pandoc", args, {
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 256 * 1024 * 1024,
    })
    if (result.status !== 0) {
      throw new PublishError(`Pandoc failed for ${this.edition.folder}:\n${result.stderr || result.stdout}`)
    }
    return result.stdout
  }

  private static require(tools: string[]) {
    const missing = tools.filter((tool) => {
      const result = spawnSync(tool, ["--version"], { encoding: "utf8", windowsHide: true })
      return result.error !== undefined || result.status !== 0
    })
    if (missing.length) throw new MissingToolError(missing)
  }
}

function escape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
