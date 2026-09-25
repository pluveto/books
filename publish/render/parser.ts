import type { Root } from "mdast"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"
import { MacroSet } from "../model/macro-set.ts"
import type { NoteParser } from "../obsidian/series-reader.ts"
import { QuartzTransformers } from "./quartz.ts"
import "./wikilink.ts"

/** Parses notes into Markdown ASTs with Obsidian syntax. Parsing needs no book settings. */
export class MarkdownParser implements NoteParser {
  private readonly quartz = new QuartzTransformers(MacroSet.EMPTY)
  private readonly processor = unified().use(remarkParse).use(remarkGfm).use(this.quartz.markdownPlugins())

  parse(body: string): Root {
    return this.processor.parse(this.quartz.text(body))
  }
}
