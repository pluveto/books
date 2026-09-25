import type { Root } from "mdast"
import type { VFile } from "vfile"
import { visit } from "unist-util-visit"
import { messages } from "../i18n.ts"
import { renderScope } from "./scope.ts"

/** Obsidian's callout aliases, resolved to the type whose title the interface provides. */
const ALIASES: Readonly<Record<string, string>> = {
  summary: "abstract",
  tldr: "abstract",
  hint: "tip",
  important: "tip",
  check: "success",
  done: "success",
  help: "question",
  faq: "question",
  attention: "warning",
  caution: "warning",
  fail: "failure",
  missing: "failure",
  error: "danger",
  cite: "quote",
}

const UNTITLED = /^\[!([\w-]+)\]([+-]?)[ \t]*$/

/**
 * A callout written without a title (`> [!proof]-`) gets its type's name in the page's
 * language. Runs before Quartz's callout transform, which would use the English type name.
 */
export function remarkCalloutTitles() {
  return (tree: Root, file: VFile) => {
    const titles = messages(renderScope(file).chapter.edition.language).calloutTitles
    visit(tree, "blockquote", (node) => {
      const [first] = node.children
      if (first?.type !== "paragraph" || first.children.length !== 1) return
      const [text] = first.children
      if (text?.type !== "text") return
      const [line = "", ...rest] = text.value.split("\n")
      const match = UNTITLED.exec(line)
      if (!match?.[1]) return
      const type = match[1].toLowerCase()
      const title = titles[ALIASES[type] ?? type]
      if (title) text.value = [`[!${match[1]}]${match[2] ?? ""} ${title}`, ...rest].join("\n")
    })
  }
}
