import fs from "node:fs"
import path from "node:path"
import { PublishError } from "../errors.ts"
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
 * The website build. Everything is rendered and written to a staging folder first, so a
 * failure at any step leaves the previous site untouched; only then is it moved into place.
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
    outputs.set(OUTPUT.marker, "Built by the books publisher; this folder is replaced on every build.\n")
    for (const asset of context.assets.files) outputs.set(asset.output, asset.content)

    const staging = path.join(path.dirname(out), `.${path.basename(out)}.staging`)
    fs.rmSync(staging, { recursive: true, force: true })
    try {
      for (const [file, content] of outputs) Site.write(staging, file, content)
      const copied = media.copyTo(staging)
      const search = this.options.search ?? writeSearchIndex
      if (search)
        await search(
          staging,
          pages.map((page) => ({ url: page.pathname, file: routes.file(page.pathname) })),
        )
      Site.replace(out, staging)
      return { pages: pages.length, files: outputs.size + copied }
    } finally {
      fs.rmSync(staging, { recursive: true, force: true })
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

  /** Only a folder this publisher made (or an empty one) may be replaced. */
  private static assertReplaceable(out: string) {
    if (!fs.existsSync(out)) return
    if (!fs.statSync(out).isDirectory()) throw new PublishError(`Output ${out} is a file, not a folder.`)
    const entries = fs.readdirSync(out).filter((entry) => entry !== OUTPUT.pdf)
    if (entries.length === 0 || entries.includes(OUTPUT.marker)) return
    throw new PublishError(
      `Refusing to replace ${out}: it is not empty and was not created by this publisher. Delete it or pick another --out.`,
    )
  }

  private static existingPdfs(out: string): Set<string> {
    const folder = path.join(out, OUTPUT.pdf)
    return new Set(
      fs.existsSync(folder) ? fs.readdirSync(folder).filter((name) => name.endsWith(".pdf")) : [],
    )
  }

  /** Swaps the staged site in, keeping PDFs, which `npm run pdf` builds separately. */
  private static replace(out: string, staging: string) {
    fs.mkdirSync(out, { recursive: true })
    for (const entry of fs.readdirSync(out)) {
      if (entry !== OUTPUT.pdf) fs.rmSync(path.join(out, entry), { recursive: true, force: true })
    }
    for (const entry of fs.readdirSync(staging))
      fs.renameSync(path.join(staging, entry), path.join(out, entry))
  }

  private static write(root: string, file: string, content: string | Buffer) {
    const target = path.join(root, ...file.split("/"))
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content)
  }
}
