export const LANGUAGES = ["zh", "en"] as const

export type LanguageCode = (typeof LANGUAGES)[number]

export function isLanguage(value: string): value is LanguageCode {
  return (LANGUAGES as readonly string[]).includes(value)
}
