import fs from "node:fs"
import path from "node:path"
import { PublishError } from "../errors.ts"
import type { Series } from "../model/series.ts"
import { FileIndex } from "../obsidian/file-index.ts"
import type { Vault } from "../obsidian/vault.ts"
import { ChapterRenderer } from "../render/renderer.ts"
import { SiteAssets } from "./assets.ts"
import { renderDocument } from "./components/document.tsx"
import { FolderSwap } from "./folder-swap.ts"
import { SourceHistory } from "./history.ts"
import { MediaLibrary } from "./media.ts"
import { SiteContext, type Page } from "./page.ts"
import { CatalogPage } from "./pages/catalog.tsx"
import { ChapterPage } from "./pages/chapter.tsx"
import { CoverPage } from "./pages/cover.tsx"
import { GatePage, NotFoundPage } from "./pages/entry.tsx"
import { PdfShelf } from "./pdf-shelf.ts"
import { OUTPUT } from "./protocol.ts"
import { Routes } from "./routes.ts"
import { writeSearchIndex, type IndexedPage } from "./search.ts"
import { sitemap } from "./sitemap.ts"
import { WebLinks } from "./web-links.ts"

export interface SiteOptions {
  readonly out: string
  /** Overrides series.md's site_url, e.g. with the URL GitHub Pages reports in CI. */
  readonly siteUrl?: URL
  /** Builds the search index into a finished site folder; `false` skips search. */
  readonly search?: ((folder: string, pages: readonly IndexedPage[]) => Promise<void>) | false
  readonly liveReload?: boolean
}

export interface BuildReport {
  readonly pages: number
  readonly files: number
}

/**
 * The website build. Everything, search index included, is written to a staging folder;
 * only a complete site replaces the output, and only an output this publisher made.
 */
export class Site {
  constructor(
    private readonly vault: Vault,
    private readonly series: Series,
    private readonly options: SiteOptions,
  ) {}

  async build(): Promise<BuildReport> {
    const out = path.resolve(this.options.out)
    Site.assertReplaceable(out)
    const routes = new Routes(this.options.siteUrl ?? this.series.settings.siteUrl)
    const media = new MediaLibrary(this.vault, routes)
    const context = new SiteContext(
      this.series,
      routes,
      await SiteAssets.build(routes),
      media,
      SourceHistory.read(this.vault),
      this.currentPdfs(out, routes),
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

    const staging = FolderSwap.scratch(out, "staging")
    FolderSwap.discard(staging)
    try {
      Site.write(
        staging,
        OUTPUT.marker,
        "Built by the books publisher; this folder is replaced on every build.\n",
      )
      for (const [file, content] of outputs) Site.write(staging, file, content)
      const copied = media.copyTo(staging)
      const search = this.options.search ?? writeSearchIndex
      if (search)
        await search(
          staging,
          pages.map((page) => ({ url: page.pathname, file: routes.file(page.pathname) })),
        )
      new FolderSwap().replace(out, staging, [OUTPUT.pdf])
      return { pages: pages.length, files: outputs.size + copied + 1 }
    } finally {
      FolderSwap.discard(staging)
    }
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

  /** PDFs whose recorded fingerprint still matches their edition's sources. */
  private currentPdfs(out: string, routes: Routes): Set<string> {
    const shelf = PdfShelf.open(path.join(out, OUTPUT.pdf))
    const names = this.series.books
      .flatMap((book) => book.editions)
      .filter((edition) =>
        shelf.isCurrent(routes.pdfName(edition), PdfShelf.fingerprint(this.vault, edition)),
      )
      .map((edition) => routes.pdfName(edition))
    return new Set(names)
  }

  /** Only a folder this publisher made (or an empty one, or one holding only PDFs) may be replaced. */
  private static assertReplaceable(out: string) {
    if (!fs.existsSync(out)) return
    if (!fs.statSync(out).isDirectory()) throw new PublishError(`Output ${out} is a file, not a folder.`)
    const entries = fs.readdirSync(out).filter((entry) => entry !== OUTPUT.pdf)
    if (entries.length === 0 || entries.includes(OUTPUT.marker)) return
    throw new PublishError(
      `Refusing to replace ${out}: it is not empty and was not created by this publisher. Delete it or pick another --out.`,
    )
  }

  private static write(root: string, file: string, content: string | Buffer) {
    const target = path.join(root, ...file.split("/"))
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content)
  }
}
