import { storage } from "./storage.ts"

/** A language chosen by hand wins over the browser's preference on the next visit. */
export function initLanguageMemory() {
  for (const link of document.querySelectorAll<HTMLAnchorElement>("a[data-language]")) {
    link.addEventListener("click", () => {
      if (link.dataset.language) storage.set("language", link.dataset.language)
    })
  }
}
