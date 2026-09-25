import type { LanguageCode } from "../../model/language.ts"
import { Cover } from "../components/book.tsx"
import { SearchDialog, SiteFooter, SiteHeader } from "../components/chrome.tsx"
import { accentStyle } from "../components/document.tsx"
import { messages } from "../../i18n.ts"
import type { Page, PageHead, SiteContext } from "../page.ts"

/** The bookshelf of one language. */
export class CatalogPage implements Page {
  readonly bodyClass = "page-catalog"

  constructor(
    private readonly site: SiteContext,
    readonly language: LanguageCode,
  ) {}

  get pathname(): string {
    return this.site.routes.catalog(this.language)
  }

  get head(): PageHead {
    const text = this.site.series.text(this.language)
    return {
      title: text.title,
      description: text.tagline,
      type: "website",
      accent: this.site.series.settings.brand,
      indexable: true,
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
    const text = messages(this.language)
    const intro = series.text(this.language)
    return (
      <>
        <SiteHeader page={this} site={this.site} />
        <main id="content" class="catalog">
          <section class="catalog-intro">
            <h1>{intro.title}</h1>
            <p class="catalog-tagline">{intro.tagline}</p>
          </section>
          <ul class="shelf" aria-label={text.books}>
            {series.editions(this.language).map((edition) => (
              <li class="shelf-item" style={accentStyle(edition.book.accent)}>
                <a class="book-card" href={routes.cover(edition)}>
                  <Cover edition={edition} site={this.site} size="card" />
                  <span class="book-card-body">
                    <h2 class="book-card-title">{edition.title}</h2>
                    <span class="book-card-subtitle">{edition.text.subtitle}</span>
                    <span class="book-card-meta">
                      <span class={`badge badge-${edition.book.status}`}>
                        {text.status[edition.book.status]}
                      </span>
                      <span>{text.chapterCount(edition.chapters.length)}</span>
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </main>
        <SiteFooter language={this.language} site={this.site} />
        <SearchDialog language={this.language} />
      </>
    )
  }
}
