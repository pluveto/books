import type { Root } from "mdast"
import type { Edition } from "./edition.ts"
import type { LanguageCode } from "./language.ts"
import type { Heading, Outline } from "./outline.ts"

export class Chapter {
  constructor(
    readonly edition: Edition,
    readonly order: number,
    /** Vault-relative path of the note. */
    readonly file: string,
    /** Line in the note where the Markdown body (after frontmatter) starts. */
    readonly bodyLine: number,
    readonly tree: Root,
    readonly outline: Outline,
    readonly description: string | undefined,
  ) {}

  get title(): string {
    return this.outline.title?.text ?? ""
  }

  /** Two-digit order used in URLs and PDF anchors: 00 is the preface. */
  get number(): string {
    return String(this.order).padStart(2, "0")
  }

  get isFrontMatter(): boolean {
    return this.order === 0
  }

  heading(reference: string): Heading | undefined {
    return this.outline.find(reference)
  }

  /** Chapters with the same number in two editions of a book are translations of each other. */
  translation(language: LanguageCode): Chapter | undefined {
    return this.edition.translation(language)?.chapter(this.order)
  }
}
