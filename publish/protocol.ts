/** Names shared by the build, the preview server and the browser scripts. */

export const OUTPUT = {
  assets: "assets",
  media: "media",
  pdf: "pdf",
  search: "pagefind",
  /** Present in every folder this publisher built, and required before one is replaced. */
  marker: ".books-site",
} as const

export const STORAGE = {
  theme: "theme",
  language: "language",
} as const

export const RELOAD_PATH = "/__reload"

/** Fired on `document` whenever the theme changes, so late-loading widgets can follow it. */
export const THEME_EVENT = "books:theme"

export const GISCUS = {
  origin: "https://giscus.app",
  script: "https://giscus.app/client.js",
} as const
