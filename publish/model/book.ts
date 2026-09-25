import type { AccentColor } from "./accent.ts"
import type { Edition } from "./edition.ts"
import type { LanguageCode } from "./language.ts"
import type { MacroSet } from "./macro-set.ts"
import type { Series } from "./series.ts"

export const BOOK_STATUSES = ["draft", "complete"] as const

export type BookStatus = (typeof BOOK_STATUSES)[number]

export function isBookStatus(value: string): value is BookStatus {
  return BOOK_STATUSES.some((status) => status === value)
}

/** Language-independent identity of a book: slug, look and math macros. */
export class Book {
  readonly editions: readonly Edition[]

  constructor(
    readonly series: Series,
    readonly slug: string,
    readonly accent: AccentColor,
    /** Vault-relative path of the cover art. */
    readonly cover: string,
    readonly status: BookStatus,
    readonly macros: MacroSet,
    editions: (book: Book) => Edition[],
  ) {
    this.editions = editions(this)
  }

  edition(language: LanguageCode): Edition | undefined {
    return this.editions.find((edition) => edition.language === language)
  }
}
