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
