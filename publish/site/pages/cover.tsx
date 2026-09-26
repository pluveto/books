import type { Edition } from "../../model/edition.ts"
import type { LanguageCode } from "../../model/language.ts"
import { chapterLabel, Cover, PdfLink, Sidebar } from "../components/book.tsx"
import { SearchDialog, SiteFooter, SiteHeader } from "../components/chrome.tsx"
import { Icon } from "../components/icon.tsx"
import { messages } from "../../i18n.ts"
import type { Page, PageHead, SiteContext } from "../page.ts"

/** A book's landing page: cover, blurb and the full table of contents. */
export class CoverPage implements Page {
  readonly bodyClass = "page-book page-cover"

  constructor(
    private readonly site: SiteContext,
    private readonly edition: Edition,
  ) {}

  get language(): LanguageCode {
    return this.edition.language
  }

  get pathname(): string {
    return this.site.routes.cover(this.edition)
  }

  get head(): PageHead {
    return {
      title: this.edition.title,
      description: this.edition.text.description,
      type: "book",
      accent: this.edition.book.accent,
      indexable: true,
    }
  }

  translations(): ReadonlyMap<LanguageCode, string> {
    return new Map(
      this.edition.book.editions.map((edition) => [edition.language, this.site.routes.cover(edition)]),
    )
  }

  switchTarget(language: LanguageCode): string {
    const translation = this.edition.translation(language)
    return translation ? this.site.routes.cover(translation) : this.site.routes.catalog(language)
  }

  body() {
    const { routes, series } = this.site
    const { edition } = this
    const text = messages(this.language)
    const first = edition.chapters[0]
    return (
      <>
        <SiteHeader page={this} site={this.site} edition={edition} hasSidebar />
        <div class="book-layout">
          <Sidebar edition={edition} site={this.site} />
          <div class="sidebar-backdrop" data-sidebar-close hidden />
          <main id="content" class="content">
            <article
              class="book-overview"
              data-pagefind-body
              data-pagefind-filter={`${text.searchBookFilter}:${edition.title}`}
            >
              <div class="book-hero">
                <Cover edition={edition} site={this.site} size="hero" />
                <div class="book-hero-text">
                  <p class="kicker">{series.text(this.language).title}</p>
                  <h1>{edition.title}</h1>
                  <p class="book-subtitle">{edition.text.subtitle}</p>
                  <p class="book-description">{edition.text.description}</p>
                  <p class="book-status">
                    <span class={`badge badge-${edition.book.status}`}>
                      {text.status[edition.book.status]}
                    </span>
                    <span>{text.chapterCount(edition.chapters.length)}</span>
                  </p>
                  <div class="book-actions">
                    {first && (
                      <a class="button button-primary" href={routes.chapter(first)}>
                        {text.startReading}
                        <Icon name="next" />
                      </a>
                    )}
                    <PdfLink edition={edition} site={this.site} />
                  </div>
                </div>
              </div>
              <section class="book-contents" aria-labelledby="book-contents">
                <h2 id="book-contents">{text.contents}</h2>
                <ol class="contents-list">
                  {edition.chapters.map((chapter) => (
                    <li class="contents-item">
                      <a class="contents-link" href={routes.chapter(chapter)}>
                        <span class="contents-number">{chapterLabel(chapter)}</span>
                        <span class="contents-title">{chapter.title}</span>
                      </a>
                      {chapter.description && <p class="contents-description">{chapter.description}</p>}
                    </li>
                  ))}
                </ol>
              </section>
            </article>
          </main>
        </div>
        <SiteFooter language={this.language} site={this.site} />
        <SearchDialog language={this.language} />
      </>
    )
  }
}
