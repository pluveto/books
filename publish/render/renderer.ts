import type { FullSlug } from "@quartz-community/types"
import type { Root as HastRoot } from "hast"
import { toHtml } from "hast-util-to-html"
import remarkRehype from "remark-rehype"
import { unified, type Processor } from "unified"
import { VFile } from "vfile"
import { messages } from "../i18n.ts"
import type { Chapter } from "../model/chapter.ts"
import type { Edition } from "../model/edition.ts"
import type { Series } from "../model/series.ts"
import type { FileIndex } from "../obsidian/file-index.ts"
import { remarkCalloutTitles } from "./callouts.ts"
import { rehypeFormulaCheck, rehypeFormulaLabels, rehypePandocMath } from "./formulas.ts"
import { rehypeHeadingAnchors, rehypeImages, remarkHeadingIds } from "./headings.ts"
import { remarkObsidianLinks } from "./links.ts"
import { QuartzTransformers } from "./quartz.ts"
import { RenderScope, type LinkTarget } from "./scope.ts"

export type OutputKind = "web" | "pdf"

/**
 * Turns parsed chapters into HTML. The web keeps MathJax SVG and Shiki highlighting;
 * the PDF gets plain TeX and plain code so Pandoc and XeLaTeX can typeset them.
 */
export class ChapterRenderer {
  private readonly processors = new Map<Edition, Processor>()

  constructor(
    private readonly series: Series,
    private readonly files: FileIndex,
    private readonly kind: OutputKind,
  ) {}

  async render(chapter: Chapter, target: LinkTarget): Promise<string> {
    const file = new VFile({ path: chapter.file })
    file.data.slug = "index" as FullSlug
    file.data.scope = new RenderScope(this.series, this.files, chapter, target)
    const tree = (await this.processor(chapter.edition).run(structuredClone(chapter.tree), file)) as HastRoot
    return toHtml(tree, { allowDangerousHtml: true })
  }

  /** One processor per edition: macros belong to the book, footnote labels to the language. */
  private processor(edition: Edition): Processor {
    const cached = this.processors.get(edition)
    if (cached) return cached
    const quartz = new QuartzTransformers(edition.book.macros)
    const text = messages(edition.language)
    const processor = unified()
      .use(remarkObsidianLinks)
      .use(remarkHeadingIds)
      .use(remarkCalloutTitles)
      .use(quartz.markdownPlugins())
      .use(remarkRehype, {
        allowDangerousHtml: true,
        footnoteLabel: text.footnotes,
        footnoteBackLabel: (index: number) => text.backToReference(index + 1),
      })
      .use(quartz.obsidianHtmlPlugins())
    if (this.kind === "web") {
      processor
        .use(rehypeFormulaLabels)
        .use(quartz.mathHtmlPlugins())
        .use(rehypeFormulaCheck)
        .use(quartz.highlightingHtmlPlugins())
        .use(rehypeHeadingAnchors)
        .use(rehypeImages)
    } else {
      processor.use(rehypePandocMath)
    }
    const frozen = processor.freeze() as unknown as Processor
    this.processors.set(edition, frozen)
    return frozen
  }
}
