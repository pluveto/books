import { renderToString } from "preact-render-to-string"
import { AccentColor } from "../../model/accent.ts"
import { messages } from "../../i18n.ts"
import type { Page, SiteContext } from "../page.ts"
import { RELOAD_PATH, STORAGE } from "../../protocol.ts"

/**
 * Runs before first paint so a saved theme never flashes the other one. The `js` class
 * turns on script-driven layout (drawer, folding); it is withdrawn if the bundle fails to
 * load, so the page falls back to its no-script form.
 */
const THEME_BOOT = `(function(){var d=document.documentElement;d.classList.add("js");addEventListener("error",function(e){var s=e.target;if(s&&s.tagName==="SCRIPT"&&s.hasAttribute("data-bundle"))d.classList.remove("js")},true);try{var t=localStorage.getItem(${JSON.stringify(STORAGE.theme)})}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";d.dataset.theme=t})()`

const LIVE_RELOAD = `new EventSource(${JSON.stringify(RELOAD_PATH)}).onmessage=function(){location.reload()}`

/** Inline custom properties; the stylesheet picks the light or dark one per theme. */
export function accentStyle(accent: AccentColor): string {
  return `--book-accent:${accent.hex};--book-accent-dark:${accent.onDarkSurface().hex}`
}

export async function renderDocument(page: Page, site: SiteContext): Promise<string> {
  const { routes, series, assets } = site
  const text = messages(page.language)
  const canonical = routes.absolute(page.pathname)
  const translations = page.translations()
  const seriesTitle = series.text(page.language).title
  const title = page.head.title === seriesTitle ? seriesTitle : `${page.head.title} · ${seriesTitle}`
  const accent = page.head.accent
  const style = accentStyle(accent)
  const body = await page.body()

  const html = (
    <html lang={text.htmlLang} data-theme="light" style={style}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={page.head.description} />
        {page.head.indexable ? (
          <link rel="canonical" href={canonical} />
        ) : (
          <meta name="robots" content="noindex" />
        )}
        {page.head.indexable &&
          [...translations].map(([language, pathname]) => (
            <link rel="alternate" hreflang={messages(language).htmlLang} href={routes.absolute(pathname)} />
          ))}
        {page.head.indexable && translations.size > 1 && (
          <link
            rel="alternate"
            hreflang="x-default"
            href={routes.absolute(translations.get(series.defaultLanguage) ?? page.pathname)}
          />
        )}
        <meta property="og:type" content={page.head.type} />
        <meta property="og:site_name" content={seriesTitle} />
        <meta property="og:title" content={page.head.title} />
        <meta property="og:description" content={page.head.description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:locale" content={text.ogLocale} />
        {[...translations.keys()]
          .filter((language) => language !== page.language)
          .map((language) => (
            <meta property="og:locale:alternate" content={messages(language).ogLocale} />
          ))}
        <meta name="twitter:card" content="summary" />
        <meta name="theme-color" content={accent.hex} media="(prefers-color-scheme: light)" />
        <meta
          name="theme-color"
          content={AccentColor.DARK_SURFACE.hex}
          media="(prefers-color-scheme: dark)"
        />
        <meta name="color-scheme" content="light dark" />
        <link rel="icon" href={assets.favicon} type="image/svg+xml" />
        <link rel="apple-touch-icon" href={assets.touchIcon} />
        <link rel="stylesheet" href={assets.stylesheet} />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <script src={assets.script} defer data-bundle />
        {site.liveReload && <script dangerouslySetInnerHTML={{ __html: LIVE_RELOAD }} />}
      </head>
      <body
        class={page.bodyClass}
        data-search-bundle={routes.searchBundle()}
        data-search-base={routes.base}
        data-search-unavailable={text.searchUnavailable}
        data-copy-label={text.copy}
        data-copied-label={text.copied}
      >
        <a class="skip-link" href="#content">
          {text.skipToContent}
        </a>
        {body}
      </body>
    </html>
  )
  return `<!DOCTYPE html>\n${renderToString(html)}\n`
}
