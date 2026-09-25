import fs from "node:fs"
import path from "node:path"
import type { Element, Root } from "hast"
import { fromHtml } from "hast-util-from-html"
import { visit } from "unist-util-visit"

export interface HtmlPage {
  readonly file: string
  readonly pathname: string
  readonly tree: Root
  readonly ids: ReadonlySet<string>
}

/** Every HTML page of a built site, parsed once, addressable by URL path. */
export class BuiltSite {
  readonly pages: readonly HtmlPage[]
  private readonly byPath = new Map<string, HtmlPage>()

  constructor(
    readonly root: string,
    readonly base: string,
  ) {
    this.pages = BuiltSite.walk(root)
      .filter((file) => file.endsWith(".html"))
      .map((file) => {
        const tree = fromHtml(fs.readFileSync(path.join(root, file), "utf8"))
        const ids = new Set<string>()
        visit(tree, "element", (node) => {
          if (typeof node.properties.id === "string") ids.add(node.properties.id)
        })
        const pathname = base + file.replace(/(^|\/)index\.html$/, "$1")
        return { file, pathname, tree, ids }
      })
    for (const page of this.pages) this.byPath.set(page.pathname, page)
  }

  page(pathname: string): HtmlPage | undefined {
    return this.byPath.get(pathname)
  }

  exists(pathname: string): boolean {
    if (!pathname.startsWith(this.base)) return false
    const relative = decodeURIComponent(pathname.slice(this.base.length))
    const target = path.join(this.root, ...relative.split("/"))
    if (relative === "" || relative.endsWith("/")) return fs.existsSync(path.join(target, "index.html"))
    return fs.existsSync(target) && fs.statSync(target).isFile()
  }

  static elements(tree: Root, test: (node: Element) => boolean): Element[] {
    const found: Element[] = []
    visit(tree, "element", (node) => {
      if (test(node)) found.push(node)
    })
    return found
  }

  static walk(root: string, prefix = ""): string[] {
    const files: string[] = []
    for (const entry of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) files.push(...BuiltSite.walk(root, rel))
      else files.push(rel)
    }
    return files.sort()
  }
}

export function attribute(node: Element, name: string): string | undefined {
  const value = node.properties[name]
  if (value === undefined || value === null || value === false) return undefined
  return Array.isArray(value) ? value.join(" ") : String(value)
}
