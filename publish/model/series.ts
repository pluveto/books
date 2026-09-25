import type { AccentColor } from "./accent.ts"
import type { Book } from "./book.ts"
import type { Chapter } from "./chapter.ts"
import type { Edition } from "./edition.ts"
import type { LanguageCode } from "./language.ts"

export interface License {
  readonly name: string
  readonly url: string
}

export interface SeriesSettings {
  /** Canonical public URL of the site root, always ending with a slash. */
  readonly siteUrl: URL
  readonly repository: string | undefined
  readonly branch: string
  /** Colour of pages that belong to no single book: the entry page, catalogs and 404. */
  readonly brand: AccentColor
  readonly textLicense: License
  readonly codeLicense: License
}

export interface SeriesText {
  readonly title: string
  readonly tagline: string
  readonly author: string | undefined
}

/** What a vault file stands for once published. */
export type Place =
  | { readonly kind: "series" }
  | { readonly kind: "book"; readonly book: Book }
  | { readonly kind: "chapter"; readonly chapter: Chapter }
  | { readonly kind: "media"; readonly file: string }

/** Aggregate root: every book, edition and chapter is reached through the series. */
export class Series {
  readonly books: readonly Book[]
  private readonly places = new Map<string, Place>()

  constructor(
    readonly file: string,
    readonly settings: SeriesSettings,
    readonly languages: readonly LanguageCode[],
    private readonly texts: ReadonlyMap<LanguageCode, SeriesText>,
    books: (series: Series) => { book: Book; file: string }[],
  ) {
    this.places.set(file, { kind: "series" })
    this.books = books(this).map(({ book, file: bookFile }) => {
      this.places.set(bookFile, { kind: "book", book })
      for (const edition of book.editions) {
        for (const chapter of edition.chapters) this.places.set(chapter.file, { kind: "chapter", chapter })
      }
      return book
    })
  }

  get defaultLanguage(): LanguageCode {
    return this.languages[0] ?? "zh"
  }

  text(language: LanguageCode): SeriesText {
    const text = this.texts.get(language)
    if (!text) throw new Error(`series has no text for ${language}`)
    return text
  }

  editions(language: LanguageCode): Edition[] {
    return this.books.flatMap((book) => book.edition(language) ?? [])
  }

  chapters(): Chapter[] {
    return this.books.flatMap((book) => book.editions.flatMap((edition) => [...edition.chapters]))
  }

  /** Notes map to pages; any other vault file is published as media. */
  locate(file: string): Place {
    return this.places.get(file) ?? { kind: "media", file }
  }
}
