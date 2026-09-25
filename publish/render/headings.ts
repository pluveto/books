import type { Element, Root as HastRoot } from "hast"
import type { Root } from "mdast"
import type { VFile } from "vfile"
import { visit } from "unist-util-visit"
import { renderScope } from "./scope.ts"

/**
 * Gives every heading the id its chapter's Outline computed, then drops the title heading;
 * page layouts render the title themselves.
 */
export function remarkHeadingIds() {
  return (tree: Root, file: VFile) => {
    const scope = renderScope(file)
    const { chapter } = scope
    const headings = chapter.outline.headings
    let index = 0
    visit(tree, "heading", (node) => {
      const heading = headings[index++]
      if (!heading) throw new Error(`outline of ${chapter.file} is out of sync with its tree`)
      node.data = {
        ...node.data,
        hProperties: { ...node.data?.hProperties, id: scope.target.headingId(chapter, heading) },
      }
    })
    const first = tree.children.findIndex((node) => node.type === "heading")
    if (first >= 0 && tree.children[first]?.type === "heading" && tree.children[first].depth === 1) {
      tree.children.splice(first, 1)
    }
  }
}

/**
 * A hover anchor after each section heading. It stays out of the tab order and the
 * accessibility tree; the sidebar is the keyboard route to sections.
 */
export function rehypeHeadingAnchors() {
  return (tree: HastRoot) => {
    visit(tree, "element", (node: Element) => {
      if (!/^h[2-6]$/.test(node.tagName) || typeof node.properties.id !== "string") return
      const classes = node.properties.className
      if (Array.isArray(classes) && classes.includes("sr-only")) return
      node.children.push({
        type: "element",
        tagName: "a",
        properties: {
          className: ["heading-anchor"],
          href: `#${node.properties.id}`,
          ariaHidden: "true",
          tabIndex: -1,
        },
        children: [{ type: "text", value: "#" }],
      })
    })
  }
}

/** Chapter images are below the fold far more often than not. */
export function rehypeImages() {
  return (tree: HastRoot) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "img") return
      node.properties.loading = "lazy"
      node.properties.decoding = "async"
    })
  }
}
