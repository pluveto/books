import path from "node:path"
import type { Image, Link, Nodes, PhrasingContent, Root } from "mdast"
import type { VFile } from "vfile"
import { SKIP, visit } from "unist-util-visit"
import { PublishError } from "../errors.ts"
import type { Chapter } from "../model/chapter.ts"
import type { Heading } from "../model/outline.ts"
import type { Place } from "../model/series.ts"
import { renderScope, type RenderScope } from "./scope.ts"
import type { Wikilink } from "./wikilink.ts"

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg"])
const SCHEME = /^[a-z][a-z0-9+.-]*:|^\/\//i

interface Reference {
  readonly path: string
  readonly heading: string
  readonly written: string
  readonly line: number | undefined
}

/** Resolves a link target inside the vault with Obsidian's rules and turns it into a URL. */
class LinkResolver {
  constructor(private readonly scope: RenderScope) {}

  href(reference: Reference): { url: string; label: string } {
    if (!reference.path) return this.chapterHref(this.scope.chapter, reference)
    const place = this.place(reference)
    switch (place.kind) {
      case "chapter":
        return this.chapterHref(place.chapter, reference)
      case "book": {
        const edition = place.book.edition(this.language) ?? place.book.editions[0]
        if (!edition) throw this.error(reference, "the book has no editions")
        this.rejectHeading(reference)
        return { url: this.scope.target.cover(edition), label: edition.title }
      }
      case "series":
        this.rejectHeading(reference)
        return {
          url: this.scope.target.catalog(this.language),
          label: this.scope.series.text(this.language).title,
        }
      case "media":
        this.rejectHeading(reference)
        return { url: this.scope.target.media(place.file), label: path.posix.basename(place.file) }
    }
  }

  image(reference: Reference): string {
    const place = this.place(reference)
    if (place.kind !== "media")
      throw this.error(reference, "embedding notes is not supported; link to it instead")
    const extension = path.posix.extname(place.file).toLowerCase()
    if (!IMAGE_EXTENSIONS.has(extension)) {
      throw this.error(reference, `cannot embed ${extension || "this"} files; only images can be embedded`)
    }
    return this.scope.target.media(place.file)
  }

  private get language() {
    return this.scope.chapter.edition.language
  }

  private place(reference: Reference): Place {
    const resolution = this.scope.files.resolve(reference.path, this.scope.chapter.file)
    switch (resolution.kind) {
      case "missing":
        throw this.error(reference, "no note or file with that name")
      case "ambiguous": {
        const options = resolution.candidates.map((file) => `[[${file.replace(/\.md$/, "")}]]`).join(" or ")
        throw this.error(reference, `several files match; write the path instead: ${options}`)
      }
      case "found": {
        const place = this.scope.series.locate(resolution.file)
        if (place.kind === "media" && resolution.file.endsWith(".md")) {
          throw this.error(reference, "only chapters, book.md and series.md can be linked")
        }
        return place
      }
    }
  }

  private chapterHref(chapter: Chapter, reference: Reference): { url: string; label: string } {
    if (!reference.heading) return { url: this.scope.target.chapter(chapter), label: chapter.title }
    if (reference.heading.startsWith("^")) throw this.error(reference, "block references are not supported")
    const heading: Heading | undefined = chapter.heading(reference.heading)
    if (!heading) {
      throw this.error(reference, `no heading "${reference.heading}" in ${chapter.file}`)
    }
    const label = chapter === this.scope.chapter ? heading.text : `${chapter.title} › ${heading.text}`
    return { url: this.scope.target.chapter(chapter, heading), label }
  }

  private rejectHeading(reference: Reference) {
    if (reference.heading) throw this.error(reference, "only chapters have headings to link to")
  }

  private error(reference: Reference, reason: string): PublishError {
    return new PublishError(
      `cannot resolve ${reference.written}: ${reason}.`,
      this.scope.location(reference.line),
    )
  }
}

/** `![[img.png|alt|300x200]]`: trailing size, everything before it is alt text. */
function imageOptions(alias: string): { alt: string | undefined; width?: string; height?: string } {
  const parts = alias.split("|").map((part) => part.trim())
  const size = /^(\d+)(?:x(\d+))?$/.exec(parts.at(-1) ?? "")
  if (size) parts.pop()
  const alt = parts.join("|") || undefined
  return size ? { alt, width: size[1], height: size[2] } : { alt }
}

function splitUrl(url: string): { path: string; heading: string } {
  const hash = url.indexOf("#")
  const raw = hash < 0 ? url : url.slice(0, hash)
  const fragment = hash < 0 ? "" : url.slice(hash + 1)
  const decode = (value: string) => {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }
  return { path: decode(raw), heading: decode(fragment) }
}

/**
 * Replaces wikilinks and relative Markdown links with resolved links. Runs before Quartz's
 * own wikilink conversion, which then finds nothing left to convert.
 */
export function remarkObsidianLinks() {
  return (tree: Root, file: VFile) => {
    const resolver = new LinkResolver(renderScope(file))
    visit(tree, (node: Nodes, index, parent) => {
      if (!parent || index === undefined) return
      const line = node.position?.start.line

      if (node.type === "wikilink") {
        const link: Wikilink = node
        const written = `${link.embedded ? "!" : ""}[[${link.path}${link.heading ? `#${link.heading}` : ""}${link.alias ? `|${link.alias}` : ""}]]`
        const reference = { path: link.path.trim(), heading: link.heading.trim(), written, line }
        if (SCHEME.test(reference.path)) {
          parent.children[index] = externalLink(reference.path, link.alias || reference.path)
        } else if (link.embedded) {
          const options = imageOptions(link.alias)
          parent.children[index] = {
            type: "image",
            url: resolver.image(reference),
            alt: options.alt ?? path.posix.parse(reference.path).name,
            data: { hProperties: { width: options.width, height: options.height } },
          } satisfies Image
        } else {
          const { url, label } = resolver.href(reference)
          parent.children[index] = {
            type: "link",
            url,
            children: [{ type: "text", value: link.alias.trim() || label }],
          } satisfies Link
        }
        return SKIP
      }

      if (
        (node.type === "link" || node.type === "image") &&
        !SCHEME.test(node.url) &&
        !node.url.startsWith("#")
      ) {
        const { path: target, heading } = splitUrl(node.url)
        const reference = { path: target, heading, written: `(${node.url})`, line }
        node.url = node.type === "image" ? resolver.image(reference) : resolver.href(reference).url
      }
      return undefined
    })
  }
}

function externalLink(url: string, label: string): PhrasingContent {
  return { type: "link", url, children: [{ type: "text", value: label }] }
}
