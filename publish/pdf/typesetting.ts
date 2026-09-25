import type { LanguageCode } from "../model/language.ts"

/** How XeLaTeX typesets an edition in one language. */
export interface Typesetting {
  readonly documentClass: string
  readonly classOptions: readonly string[]
  /** Font family for CJK text, if the language needs one; BOOKS_CJK_FONT overrides it. */
  readonly cjkFont?: string
}

const TYPESETTING: Readonly<Record<LanguageCode, Typesetting>> = {
  zh: { documentClass: "ctexbook", classOptions: ["oneside", "fontset=none"], cjkFont: "Noto Serif CJK SC" },
  en: { documentClass: "book", classOptions: ["oneside"] },
}

export function typesetting(language: LanguageCode): Typesetting {
  return TYPESETTING[language]
}
