/** Obsidian's foldable callouts (`> [!note]-`) open and close by click or keyboard. */
export function initCallouts() {
  for (const callout of document.querySelectorAll<HTMLElement>(".callout.is-collapsible")) {
    const title = callout.querySelector<HTMLElement>(".callout-title")
    if (!title) continue
    title.tabIndex = 0
    title.setAttribute("role", "button")
    const sync = () =>
      title.setAttribute("aria-expanded", String(!callout.classList.contains("is-collapsed")))
    const toggle = () => {
      callout.classList.toggle("is-collapsed")
      sync()
    }
    sync()
    title.addEventListener("click", toggle)
    title.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        toggle()
      }
    })
  }
}
