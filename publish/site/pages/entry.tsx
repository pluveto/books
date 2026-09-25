import type { LanguageCode } from "../../model/language.ts"
import { BrandMark, SearchDialog, SiteFooter, SiteHeader } from "../components/chrome.tsx"
import { messages } from "../../i18n.ts"
import type { Page, PageHead, SiteContext } from "../page.ts"
import { STORAGE } from "../protocol.ts"

/**
 * The site root. With JavaScript it forwards to the reader's language (a saved choice
 * first, then the browser's preference); without, it is a plain language chooser. It is
 * not indexed: the catalogs are the pages search engines should list.
 */
export class GatePage implements Page {
  readonly bodyClass = "page-gate"

  constructor(private readonly site: SiteContext) {}

  get language(): LanguageCode {
    return this.site.series.defaultLanguage
  }

  get pathname(): string {
    return this.site.routes.gate()
  }

  get head(): PageHead {
    const text = this.site.series.text(this.language)
    return {
      title: text.title,
      description: text.tagline,
      type: "website",
      accent: this.site.series.settings.brand,
      indexable: false,
    }
  }

  translations(): ReadonlyMap<LanguageCode, string> {
    return new Map(
      this.site.series.languages.map((language) => [language, this.site.routes.catalog(language)]),
    )
  }

  switchTarget(language: LanguageCode): string {
    return this.site.routes.catalog(language)
  }

  body() {
    const { series, routes } = this.site
    const languages = JSON.stringify(series.languages)
    const redirect = `(function(){var l=${languages},p;try{p=localStorage.getItem(${JSON.stringify(STORAGE.language)})}catch(e){}if(l.indexOf(p)<0){p=null;var n=navigator.languages||[navigator.language];for(var i=0;i<n.length&&!p;i++){var c=String(n[i]).toLowerCase().split("-")[0];if(l.indexOf(c)>=0)p=c}}location.replace(${JSON.stringify(routes.base)}+(p||l[0])+"/")})()`
    return (
      <main id="content" class="gate">
        <script dangerouslySetInnerHTML={{ __html: redirect }} />
        <div class="gate-inner">
          <BrandMark />
          <h1 class="visually-hidden">{series.text(this.language).title}</h1>
          <ul class="gate-choices">
            {series.languages.map((language) => {
              const text = messages(language)
              return (
                <li>
                  <a
                    class="gate-choice"
                    href={routes.catalog(language)}
                    lang={text.htmlLang}
                    hreflang={text.htmlLang}
                    data-language={language}
                  >
                    <span class="gate-title">{series.text(language).title}</span>
                    <span class="gate-tagline">{series.text(language).tagline}</span>
                    <span class="gate-language">{text.languageName} →</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      </main>
    )
  }
}

/** GitHub Pages serves this for any missing path, so every link in it is absolute. */
export class NotFoundPage implements Page {
  readonly bodyClass = "page-error"

  constructor(private readonly site: SiteContext) {}

  get language(): LanguageCode {
    return this.site.series.defaultLanguage
  }

  get pathname(): string {
    return this.site.routes.notFound()
  }

  get head(): PageHead {
    return {
      title: messages(this.language).notFoundTitle,
      description: messages(this.language).notFoundBody,
      type: "website",
      accent: this.site.series.settings.brand,
      indexable: false,
    }
  }

  translations(): ReadonlyMap<LanguageCode, string> {
    return new Map([[this.language, this.pathname]])
  }

  switchTarget(language: LanguageCode): string {
    return this.site.routes.catalog(language)
  }

  body() {
    const { series, routes } = this.site
    return (
      <>
        <SiteHeader page={this} site={this.site} />
        <main id="content" class="error-page">
          {series.languages.map((language, index) => {
            const text = messages(language)
            const Title = index === 0 ? "h1" : "h2"
            return (
              <section class="error-block" lang={text.htmlLang}>
                <p class="error-code">404</p>
                <Title>{text.notFoundTitle}</Title>
                <p>{text.notFoundBody}</p>
                <a class="button" href={routes.catalog(language)}>
                  {text.backToBooks}
                </a>
              </section>
            )
          })}
        </main>
        <SiteFooter language={this.language} site={this.site} />
        <SearchDialog language={this.language} />
      </>
    )
  }
}
