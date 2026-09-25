/** On narrow screens the table of contents is a drawer opened from the header. */
export function initSidebar() {
  const toggle = document.querySelector<HTMLButtonElement>("[data-sidebar-toggle]")
  const sidebar = document.getElementById("sidebar")
  const backdrop = document.querySelector<HTMLElement>("[data-sidebar-close]")
  if (!toggle || !sidebar) return

  const setOpen = (open: boolean) => {
    document.body.classList.toggle("sidebar-open", open)
    toggle.setAttribute("aria-expanded", String(open))
    if (backdrop) backdrop.hidden = !open
    if (open) sidebar.querySelector<HTMLElement>("[aria-current], a")?.focus()
  }

  toggle.addEventListener("click", () => setOpen(!document.body.classList.contains("sidebar-open")))
  backdrop?.addEventListener("click", () => setOpen(false))
  sidebar.addEventListener("click", (event) => {
    if ((event.target as Element).closest("a")) setOpen(false)
  })
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("sidebar-open")) {
      setOpen(false)
      toggle.focus()
    }
  })

  const current = sidebar.querySelector<HTMLElement>(".toc-item.is-current")
  if (current) {
    const box = sidebar.getBoundingClientRect()
    const item = current.getBoundingClientRect()
    if (item.bottom > box.bottom) sidebar.scrollTop += item.top - box.top - box.height / 3
  }
}
