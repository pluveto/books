import type { LanguageCode } from "../model/language.ts"

/** How XeLaTeX typesets an edition in one language. */
export interface Typesetting {
  readonly documentClass: string
  readonly classOptions: readonly string[]
  /** Raw LaTeX added to the preamble after the book's macros. */
  readonly preamble: string
  /** Font family for CJK text, if the language needs one; BOOKS_CJK_FONT overrides it. */
  readonly cjkFont?: string
}

/** Code needs symbols (≈, →, ‖) that Latin Modern Mono lacks; BOOKS_MONO_FONT overrides it. */
export const MONO_FONT = "DejaVu Sans Mono"

const TYPESETTING: Readonly<Record<LanguageCode, Typesetting>> = {
  zh: {
    documentClass: "ctexbook",
    classOptions: ["oneside", "fontset=none"],
    preamble: "\\ctexset{chapter/number = \\arabic{chapter}}",
    cjkFont: "Noto Serif CJK SC",
  },
  en: { documentClass: "book", classOptions: ["oneside"], preamble: "" },
}

export function typesetting(language: LanguageCode): Typesetting {
  return TYPESETTING[language]
}
