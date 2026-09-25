import fs from "node:fs"
import path from "node:path"
import type { Series } from "../model/series.ts"
import { FileIndex } from "../obsidian/file-index.ts"
import type { Vault } from "../obsidian/vault.ts"
import { ChapterRenderer } from "../render/renderer.ts"
import { SiteAssets } from "./assets.ts"
import { renderDocument } from "./components/document.tsx"
import { SourceHistory } from "./history.ts"
import { MediaLibrary } from "./media.ts"
import { SiteContext, type Page } from "./page.ts"
import { CatalogPage } from "./pages/catalog.tsx"
import { ChapterPage } from "./pages/chapter.tsx"
import { CoverPage } from "./pages/cover.tsx"
import { GatePage, NotFoundPage } from "./pages/entry.tsx"
import { Routes } from "./routes.ts"
import { writeSearchIndex } from "./search.ts"
import { sitemap } from "./sitemap.ts"
import { WebLinks } from "./web-links.ts"

export interface SiteOptions {
  readonly out: string
  /** Overrides series.md's site_url, e.g. with the URL GitHub Pages reports in CI. */
  readonly siteUrl?: URL
  readonly search?: boolean
  readonly liveReload?: boolean
}

export interface BuildReport {
  readonly pages: number
  readonly files: number
}

/** Folder in the output that a site build leaves alone: PDFs are built separately. */
export const PDF_FOLDER = "pdf"

export class Site {
  constructor(
    private readonly vault: Vault,
    private readonly series: Series,
    private readonly options: SiteOptions,
  ) {}

  async build(): Promise<BuildReport> {
    const out = path.resolve(this.options.out)
    const routes = new Routes(this.options.siteUrl ?? this.series.settings.siteUrl)
    const media = new MediaLibrary(this.vault, routes)
    const context = new SiteContext(
      this.series,
      routes,
      await SiteAssets.build(routes),
      media,
      SourceHistory.read(this.vault),
      Site.existingPdfs(out),
      this.options.liveReload ?? false,
    )

    const pages = await this.pages(context)
    const outputs = new Map<string, string | Buffer>()
    for (const page of pages) outputs.set(routes.file(page.pathname), await renderDocument(page, context))
    const { xml, robots } = sitemap(pages, routes)
    outputs.set("sitemap.xml", xml)
    outputs.set("robots.txt", robots)
    outputs.set(".nojekyll", "")
    for (const asset of context.assets.files) outputs.set(asset.output, asset.content)

    Site.clean(out)
    for (const [file, content] of outputs) Site.write(out, file, content)
    const copies = media.entries()
    for (const { output, source } of copies) {
      fs.mkdirSync(path.dirname(path.join(out, output)), { recursive: true })
      fs.copyFileSync(source, path.join(out, output))
    }
    if (this.options.search ?? true) await writeSearchIndex(out)
    return { pages: pages.length, files: outputs.size + copies.length }
  }

  private async pages(context: SiteContext): Promise<Page[]> {
    const renderer = new ChapterRenderer(this.series, new FileIndex(this.vault.files), "web")
    const links = new WebLinks(context.routes, context.media)
    const pages: Page[] = [new GatePage(context), new NotFoundPage(context)]
    for (const language of this.series.languages) {
      pages.push(new CatalogPage(context, language))
      for (const edition of this.series.editions(language)) {
        pages.push(new CoverPage(context, edition))
        for (const chapter of edition.chapters) {
          pages.push(new ChapterPage(context, chapter, await renderer.render(chapter, links)))
        }
      }
    }
    return pages
  }

  private static existingPdfs(out: string): Set<string> {
    const folder = path.join(out, PDF_FOLDER)
    return new Set(
      fs.existsSync(folder) ? fs.readdirSync(folder).filter((name) => name.endsWith(".pdf")) : [],
    )
  }

  private static clean(out: string) {
    fs.mkdirSync(out, { recursive: true })
    for (const entry of fs.readdirSync(out)) {
      if (entry !== PDF_FOLDER) fs.rmSync(path.join(out, entry), { recursive: true, force: true })
    }
  }

  private static write(out: string, file: string, content: string | Buffer) {
    const target = path.join(out, ...file.split("/"))
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content)
  }
}
