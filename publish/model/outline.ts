import GithubSlugger from "github-slugger"
import type { Root } from "mdast"
import { toString } from "mdast-util-to-string"
import { visit } from "unist-util-visit"

export class Heading {
  constructor(
    readonly depth: number,
    readonly text: string,
    readonly slug: string,
    readonly line: number | undefined,
  ) {}
}

/**
 * The headings of one chapter in document order. This is the only place heading slugs
 * are computed; web ids, PDF ids, the sidebar and link targets all read from here.
 */
export class Outline {
  private constructor(readonly headings: readonly Heading[]) {}

  static of(tree: Root): Outline {
    const slugger = new GithubSlugger()
    const headings: Heading[] = []
    visit(tree, "heading", (node) => {
      const text = toString(node).trim()
      headings.push(new Heading(node.depth, text, slugger.slug(text), node.position?.start.line))
    })
    return new Outline(headings)
  }

  get title(): Heading | undefined {
    return this.headings[0]?.depth === 1 ? this.headings[0] : undefined
  }

  /** Sections shown in the sidebar and page outline. */
  get sections(): Heading[] {
    return this.headings.filter((heading) => heading.depth === 2 || heading.depth === 3)
  }

  /** Match `[[note#Heading]]` the way Obsidian does: by heading text, ignoring spacing and case. */
  find(reference: string): Heading | undefined {
    const wanted = Outline.normalize(reference)
    const slug = new GithubSlugger().slug(reference.trim())
    return (
      this.headings.find((heading) => Outline.normalize(heading.text) === wanted) ??
      this.headings.find((heading) => heading.slug === slug)
    )
  }

  private static normalize(text: string): string {
    return text.replace(/\s+/g, " ").trim().toLowerCase()
  }
}
