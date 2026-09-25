interface PagefindUIOptions {
  element: Element
  bundlePath: string
  baseUrl: string
  showSubResults: boolean
  showImages: boolean
  resetStyles: boolean
  autofocus: boolean
}

declare global {
  interface Window {
    PagefindUI?: new (options: PagefindUIOptions) => unknown
  }
}

function load(tag: "script" | "link", url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const element = document.createElement(tag)
    if (element instanceof HTMLScriptElement) element.src = url
    else if (element instanceof HTMLLinkElement) {
      element.rel = "stylesheet"
      element.href = url
    }
    element.addEventListener("load", () => resolve())
    element.addEventListener("error", () => reject(new Error(`failed to load ${url}`)))
    document.head.append(element)
  })
}

/** A modal search box. Pagefind's UI and index load on first use, not with the page. */
export function initSearch() {
  const dialog = document.querySelector<HTMLDialogElement>("[data-search-dialog]")
  const target = dialog?.querySelector("[data-search-ui]")
  const bundle = document.body.dataset.searchBundle
  const base = document.body.dataset.searchBase
  if (!dialog || !target || !bundle || !base) return
  let ready: Promise<void> | undefined

  const prepare = () => {
    ready ??= Promise.all([
      load("link", `${bundle}pagefind-ui.css`),
      load("script", `${bundle}pagefind-ui.js`),
    ]).then(() => {
      if (!window.PagefindUI) throw new Error("Pagefind UI did not load")
      new window.PagefindUI({
        element: target,
        bundlePath: bundle,
        baseUrl: base,
        showSubResults: true,
        showImages: false,
        resetStyles: false,
        autofocus: true,
      })
    })
    return ready
  }

  const open = () => {
    if (dialog.open) return
    dialog.showModal()
    prepare()
      .then(() => target.querySelector<HTMLInputElement>("input")?.focus())
      .catch(() => {
        target.textContent = document.body.dataset.searchUnavailable ?? ""
      })
  }

  for (const button of document.querySelectorAll("[data-search-open]")) button.addEventListener("click", open)
  dialog.querySelector("[data-search-close]")?.addEventListener("click", () => dialog.close())
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close()
  })
  document.addEventListener("keydown", (event) => {
    const typing = (event.target as Element | null)?.closest("input, textarea, select, [contenteditable]")
    if (
      (event.key === "/" && !typing) ||
      (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey))
    ) {
      event.preventDefault()
      open()
    }
  })
}
