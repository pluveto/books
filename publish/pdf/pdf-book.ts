import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { MissingToolError, PublishError } from "../errors.ts"
import type { Chapter } from "../model/chapter.ts"
import type { Edition } from "../model/edition.ts"
import type { LanguageCode } from "../model/language.ts"
import type { Heading } from "../model/outline.ts"
import type { Series } from "../model/series.ts"
import { FileIndex } from "../obsidian/file-index.ts"
import type { Vault } from "../obsidian/vault.ts"
import { ChapterRenderer } from "../render/renderer.ts"
import type { LinkTarget } from "../render/scope.ts"
import { messages } from "../i18n.ts"
import type { Routes } from "../site/routes.ts"

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

/** One edition as a PDF: the same chapter ASTs as the website, typeset by Pandoc and XeLaTeX. */
export class PdfBook {
  constructor(
    private readonly vault: Vault,
    private readonly series: Series,
    private readonly edition: Edition,
    private readonly routes: Routes,
  ) {}

  async write(output: string): Promise<void> {
    const missing = ["pandoc", "xelatex"].filter((tool) => !PdfBook.available(tool))
    if (missing.length) throw new MissingToolError(missing)

    const html = await this.html()
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "books-pdf-"))
    try {
      const input = path.join(work, "book.html")
      const header = path.join(work, "header.tex")
      fs.writeFileSync(input, html, "utf8")
      fs.writeFileSync(header, this.header(), "utf8")
      fs.mkdirSync(path.dirname(output), { recursive: true })
      const result = spawnSync("pandoc", [...this.arguments(header), input, "-o", output], {
        cwd: work,
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 64 * 1024 * 1024,
      })
      if (result.status !== 0) {
        throw new PublishError(`Pandoc failed for ${this.edition.folder}:\n${result.stderr || result.stdout}`)
      }
    } finally {
      fs.rmSync(work, { recursive: true, force: true })
    }
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
    return `<!DOCTYPE html>\n<html lang="${messages(this.edition.language).htmlLang}"><head><meta charset="utf-8"><title>${escape(this.edition.title)}</title></head><body>\n${sections.join("\n")}\n</body></html>\n`
  }

  private arguments(header: string): string[] {
    const text = this.series.text(this.edition.language)
    const zh = this.edition.language === "zh"
    const args = [
      "--from=html",
      "--pdf-engine=xelatex",
      "--top-level-division=chapter",
      "--toc",
      `--include-in-header=${header}`,
      `--metadata=title:${this.edition.title}`,
      `--metadata=subtitle:${this.edition.text.subtitle}`,
      `--metadata=author:${text.author ?? text.title}`,
      `--metadata=lang:${messages(this.edition.language).htmlLang}`,
      "--variable=documentclass:book",
      "--variable=classoption:oneside",
      "--variable=geometry:margin=2.5cm",
      "--variable=colorlinks:true",
      "--variable=linkcolor:black",
      "--variable=urlcolor:black",
    ]
    if (zh) args.push(`--variable=CJKmainfont:${process.env.BOOKS_CJK_FONT ?? "Noto Serif CJK SC"}`)
    return args
  }

  private header(): string {
    return `\\usepackage{amsmath,amssymb}\n${this.edition.book.macros.tex}\n`
  }

  private static available(tool: string): boolean {
    const result = spawnSync(tool, ["--version"], { encoding: "utf8", windowsHide: true })
    return !result.error && result.status === 0
  }
}

function escape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
