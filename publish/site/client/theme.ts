import { STORAGE } from "../../protocol.ts"
import { storage } from "./storage.ts"

type Theme = "light" | "dark"

export function initTheme() {
  const root = document.documentElement
  const buttons = document.querySelectorAll<HTMLButtonElement>("[data-theme-toggle]")
  const apply = (theme: Theme) => {
    root.dataset.theme = theme
    for (const button of buttons) button.setAttribute("aria-pressed", String(theme === "dark"))
  }
  apply(root.dataset.theme === "dark" ? "dark" : "light")

  for (const button of buttons) {
    button.addEventListener("click", () => {
      const next: Theme = root.dataset.theme === "dark" ? "light" : "dark"
      storage.set(STORAGE.theme, next)
      apply(next)
    })
  }

  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
    const saved = storage.get(STORAGE.theme)
    if (saved !== "light" && saved !== "dark") apply(event.matches ? "dark" : "light")
  })
}
