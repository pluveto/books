import { Latex } from "@quartz-community/latex"
import { ObsidianFlavoredMarkdown } from "@quartz-community/obsidian-flavored-markdown"
import { SyntaxHighlighting } from "@quartz-community/syntax-highlighting"
import type { BuildCtx, QuartzTransformerPluginInstance } from "@quartz-community/types"
import type { PluggableList } from "unified"
import type { MacroSet } from "../model/macro-set.ts"

/**
 * The transformer plugins only read `buildId`, `argv` and `cfg.configuration`; the rest
 * of Quartz's build context belongs to its emitters, which this publisher does not use.
 */
const context = {
  buildId: "books",
  argv: {
    directory: "vault",
    verbose: false,
    output: "dist",
    serve: false,
    watch: false,
    port: 0,
    wsPort: 0,
  },
  cfg: { configuration: { locale: "en-US" } },
  allSlugs: [],
  allFiles: [],
  incremental: false,
} as unknown as BuildCtx

/** Quartz's transformer stages for one book: text, Markdown AST, then HTML AST. */
export class QuartzTransformers {
  private readonly markdown: QuartzTransformerPluginInstance
  private readonly latex: QuartzTransformerPluginInstance
  private readonly highlighting: QuartzTransformerPluginInstance

  constructor(macros: MacroSet) {
    this.markdown = ObsidianFlavoredMarkdown({
      comments: true,
      highlight: true,
      wikilinks: true,
      callouts: true,
      mermaid: false,
      parseTags: false,
      parseBlockReferences: false,
      enableInHtmlEmbed: false,
      enableYouTubeEmbed: false,
      enableTweetEmbed: false,
      enableVideoEmbed: false,
      enableCheckbox: false,
      enableObsidianUri: false,
    })
    this.latex = Latex({ renderEngine: "mathjax", customMacros: macros.mathjax() })
    this.highlighting = SyntaxHighlighting({
      theme: { light: "github-light-default", dark: "github-dark-default" },
      keepBackground: false,
      clipboard: false,
    })
  }

  text(source: string): string {
    return this.markdown.textTransform?.(context, source) ?? source
  }

  /** Syntax (wikilinks, callouts, math) and Markdown-level transforms. */
  markdownPlugins(): PluggableList {
    return [
      ...(this.markdown.markdownPlugins?.(context) ?? []),
      ...(this.latex.markdownPlugins?.(context) ?? []),
    ]
  }

  obsidianHtmlPlugins(): PluggableList {
    return this.markdown.htmlPlugins?.(context) ?? []
  }

  mathHtmlPlugins(): PluggableList {
    return this.latex.htmlPlugins?.(context) ?? []
  }

  highlightingHtmlPlugins(): PluggableList {
    return this.highlighting.htmlPlugins?.(context) ?? []
  }
}
