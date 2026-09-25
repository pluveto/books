import type { Element, ElementContent, Root } from "hast"
import { toString } from "hast-util-to-string"
import type { VFile } from "vfile"
import { visit, SKIP } from "unist-util-visit"
import { PublishError } from "../errors.ts"
import { renderScope } from "./scope.ts"

const WRAPPER = "formula"

function mathKind(node: Element): "inline" | "display" | undefined {
  const classes = node.properties.className
  if (!Array.isArray(classes)) return undefined
  if (classes.includes("math-display")) return "display"
  if (classes.includes("math-inline")) return "inline"
  return undefined
}

function isWrapper(node: ElementContent): node is Element {
  return (
    node.type === "element" &&
    Array.isArray(node.properties.className) &&
    node.properties.className.includes(WRAPPER)
  )
}

/**
 * Wraps every formula so its TeX source survives typesetting: screen readers get the
 * source as a label, and the check below can name the formula that failed.
 */
export function rehypeFormulaLabels() {
  return (tree: Root) => {
    visit(tree, "element", (node, index, parent) => {
      if (!parent || index === undefined) return
      const target = node.tagName === "pre" ? node.children.find((child) => child.type === "element") : node
      if (!target || target.type !== "element") return
      const kind = mathKind(target)
      if (!kind) return
      const tex = toString(target).trim()
      parent.children[index] = {
        type: "element",
        tagName: kind === "display" ? "div" : "span",
        properties: {
          className: [WRAPPER, `${WRAPPER}-${kind}`],
          role: "img",
          ariaLabel: tex,
          dataLine: node.position?.start.line,
        },
        children: [node],
      }
      return SKIP
    })
  }
}

/**
 * Fails the build when MathJax could not typeset a formula instead of shipping red text,
 * and drops the per-page MathJax stylesheet: the site stylesheet carries those rules once.
 */
export function rehypeFormulaCheck() {
  return (tree: Root, file: VFile) => {
    const scope = renderScope(file)
    tree.children = tree.children.filter(
      (node) =>
        !(node.type === "element" && node.tagName === "style" && toString(node).includes("mjx-container")),
    )
    visit(tree, "element", (node) => {
      if (!isWrapper(node)) return
      const tex = String(node.properties.ariaLabel ?? "")
      const line = Number(node.properties.dataLine) || undefined
      delete node.properties.dataLine
      let problem: string | undefined
      visit(node, "element", (inner) => {
        if (inner.tagName === "svg") {
          delete inner.properties.role
          inner.properties.ariaHidden = "true"
        }
        if (problem) return
        const props = inner.properties
        if (mathKind(inner)) problem = "was not typeset"
        else if (props.dataMjxError) problem = String(props.dataMjxError)
        else if (props.dataMmlNode === "merror") problem = "has a TeX error"
        else if (props.dataMmlNode === "mtext" && props.fill === "red") problem = "uses an undefined command"
      })
      if (problem) {
        throw new PublishError(`formula $${tex}$ ${problem}.`, scope.location(line))
      }
      return SKIP
    })
  }
}

/**
 * For the PDF: `span.math` with the TeX in `data-tex`, which publish/pdf/obsidian.lua turns
 * into Pandoc math. An attribute, unlike text, is not rewritten by Pandoc's smart quotes.
 */
export function rehypePandocMath() {
  return (tree: Root) => {
    visit(tree, "element", (node, index, parent) => {
      if (!parent || index === undefined) return
      const target = node.tagName === "pre" ? node.children.find((child) => child.type === "element") : node
      if (!target || target.type !== "element") return
      const kind = mathKind(target)
      if (!kind) return
      const tex = toString(target).trim()
      parent.children[index] = {
        type: "element",
        tagName: "span",
        properties: { className: ["math", kind], dataTex: tex },
        children: [],
      }
      return SKIP
    })
  }
}
