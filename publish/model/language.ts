export const LANGUAGES = ["zh", "en"] as const

export type LanguageCode = (typeof LANGUAGES)[number]

/** A series is published in at least one language; the first is its default. */
export type Languages = readonly [LanguageCode, ...LanguageCode[]]

export function isLanguage(value: string): value is LanguageCode {
  return (LANGUAGES as readonly string[]).includes(value)
}
