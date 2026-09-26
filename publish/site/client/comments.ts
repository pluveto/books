import { GISCUS, THEME_EVENT } from "../../protocol.ts"

type Theme = "light" | "dark"

/**
 * Mounts the giscus thread the first time it comes near the viewport, then keeps its
 * theme in step with the page. Nothing is requested from giscus until that happens.
 */
export function initComments() {
  const mount = document.querySelector<HTMLElement>("[data-comments]")
  if (!mount) return

  let loaded = false
  const load = () => {
    if (loaded) return
    loaded = true
    const script = document.createElement("script")
    script.src = GISCUS.script
    script.async = true
    script.crossOrigin = "anonymous"
    Object.assign(script.dataset, {
      repo: mount.dataset.commentsRepo ?? "",
      repoId: mount.dataset.commentsRepoId ?? "",
      category: mount.dataset.commentsCategory ?? "",
      categoryId: mount.dataset.commentsCategoryId ?? "",
      mapping: "specific",
      term: mount.dataset.commentsTerm ?? "",
      strict: "1",
      reactionsEnabled: "1",
      emitMetadata: "0",
      inputPosition: "top",
      lang: mount.dataset.commentsLang ?? "en",
      theme: currentTheme(),
      loading: "lazy",
    })
    script.addEventListener("error", () => {
      const notice = document.createElement("p")
      notice.className = "comments-unavailable"
      notice.textContent = mount.dataset.commentsUnavailable ?? ""
      mount.append(notice)
    })
    mount.append(script)
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        load()
      },
      { rootMargin: "200px" },
    )
    observer.observe(mount)
  } else {
    load()
  }

  document.addEventListener(THEME_EVENT, () => {
    const frame = mount.querySelector<HTMLIFrameElement>("iframe.giscus-frame")
    frame?.contentWindow?.postMessage({ giscus: { setConfig: { theme: currentTheme() } } }, GISCUS.origin)
  })
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light"
}
