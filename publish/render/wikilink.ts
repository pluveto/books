import type { Literal } from "mdast"

/** The node Quartz's Obsidian syntax extension produces for `[[...]]` and `![[...]]`. */
export interface Wikilink extends Literal {
  type: "wikilink"
  embedded: boolean
  path: string
  heading: string
  alias: string
}

declare module "mdast" {
  interface PhrasingContentMap {
    wikilink: Wikilink
  }
  interface RootContentMap {
    wikilink: Wikilink
  }
}
