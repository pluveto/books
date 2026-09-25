const COPY_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'
const DONE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>'

export function initCodeCopy() {
  if (!navigator.clipboard) return
  const copyLabel = document.body.dataset.copyLabel ?? "Copy"
  const copiedLabel = document.body.dataset.copiedLabel ?? "Copied"
  for (const pre of document.querySelectorAll<HTMLPreElement>(".prose pre")) {
    const code = pre.querySelector("code")
    if (!code || code.closest(".formula")) continue
    const button = document.createElement("button")
    button.type = "button"
    button.className = "copy-button"
    button.setAttribute("aria-label", copyLabel)
    button.innerHTML = COPY_ICON
    let timer: number | undefined
    button.addEventListener("click", () => {
      void navigator.clipboard.writeText(code.innerText.replace(/\n$/, "")).then(() => {
        button.innerHTML = DONE_ICON
        button.setAttribute("aria-label", copiedLabel)
        button.classList.add("is-done")
        window.clearTimeout(timer)
        timer = window.setTimeout(() => {
          button.innerHTML = COPY_ICON
          button.setAttribute("aria-label", copyLabel)
          button.classList.remove("is-done")
        }, 1800)
      })
    })
    ;(pre.parentElement?.matches("figure") ? pre.parentElement : pre).append(button)
  }
}
