/** Highlights the sidebar entry of the section currently at the top of the viewport. */
export function initScrollSpy() {
  const links = [...document.querySelectorAll<HTMLAnchorElement>("[data-section]")]
  const pairs = links
    .map((link) => ({ link, heading: document.getElementById(link.dataset.section ?? "") }))
    .filter((pair): pair is { link: HTMLAnchorElement; heading: HTMLElement } => pair.heading !== null)
  if (!pairs.length) return

  let active: HTMLAnchorElement | undefined
  let scheduled = false
  const update = () => {
    scheduled = false
    const offset =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-height")) || 56
    let current = pairs[0]?.link
    for (const { link, heading } of pairs) {
      if (heading.getBoundingClientRect().top - offset - 24 <= 0) current = link
      else break
    }
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
    if (atBottom) current = pairs.at(-1)?.link
    if (current === active) return
    active?.classList.remove("is-active")
    active?.removeAttribute("aria-current")
    current?.classList.add("is-active")
    current?.setAttribute("aria-current", "location")
    active = current
  }
  const schedule = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(update)
  }
  window.addEventListener("scroll", schedule, { passive: true })
  window.addEventListener("resize", schedule)
  update()
}
