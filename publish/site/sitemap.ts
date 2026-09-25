import { messages } from "../i18n.ts"
import type { Page } from "./page.ts"
import type { Routes } from "./routes.ts"

function escape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/** sitemap.xml with hreflang alternates, and a robots.txt pointing at it. */
export function sitemap(pages: readonly Page[], routes: Routes): { xml: string; robots: string } {
  const entries = pages
    .filter((page) => page.head.indexable && page.pathname !== routes.gate())
    .map((page) => {
      const alternates = [...page.translations()]
        .map(
          ([language, pathname]) =>
            `    <xhtml:link rel="alternate" hreflang="${messages(language).htmlLang}" href="${escape(routes.absolute(pathname))}"/>`,
        )
        .join("\n")
      return `  <url>\n    <loc>${escape(routes.absolute(page.pathname))}</loc>\n${alternates}\n  </url>`
    })
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join("\n")}
</urlset>
`
  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${routes.absolute(routes.sitemap())}\n`
  return { xml, robots }
}
