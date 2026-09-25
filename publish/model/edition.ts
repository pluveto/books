import type { Book } from "./book.ts"
import type { Chapter } from "./chapter.ts"
import type { LanguageCode } from "./language.ts"

export interface EditionText {
  readonly title: string
  readonly subtitle: string
  readonly description: string
}

/** One book in one language: its own title and its own chapters. */
export class Edition {
  readonly chapters: readonly Chapter[]

  constructor(
    readonly book: Book,
    readonly language: LanguageCode,
    /** Vault-relative folder holding this edition's chapters. */
    readonly folder: string,
    readonly text: EditionText,
    chapters: (edition: Edition) => Chapter[],
  ) {
    this.chapters = chapters(this)
  }

  get title(): string {
    return this.text.title
  }

  chapter(order: number): Chapter | undefined {
    return this.chapters.find((chapter) => chapter.order === order)
  }

  previous(chapter: Chapter): Chapter | undefined {
    return this.chapters[this.chapters.indexOf(chapter) - 1]
  }

  next(chapter: Chapter): Chapter | undefined {
    const index = this.chapters.indexOf(chapter)
    return index < 0 ? undefined : this.chapters[index + 1]
  }

  /** The same book in another language, if it has been written. */
  translation(language: LanguageCode): Edition | undefined {
    return language === this.language ? this : this.book.edition(language)
  }
}
